"""
Opaque, versioned pagination tokens for the REST API.

Background
----------
DynamoDB pagination works by returning a ``LastEvaluatedKey`` (the primary key
of the last item read) which the client passes back as ``ExclusiveStartKey`` on
the next request. That key contains internal table structure -- partition/sort
keys, GSI keys, and timestamps -- so it must NOT be handed to clients verbatim
or merely base64-encoded (base64 is reversible and reveals the structure).

AWS pagination-token guidance requires that tokens be:

- **Opaque**: the client cannot read or infer the internal key structure.
- **Versioned**: the server can evolve the token format without breaking
  in-flight tokens or silently mis-parsing an old one.
- **Integrity protected**: a client cannot tamper with the token to steer the
  query toward data it should not reach. We additionally bind each token to a
  *purpose* (and, where relevant, the caller's identity) so a token minted for
  one endpoint or user cannot be replayed against another.

Mechanism
---------
The serialized ``LastEvaluatedKey`` is encrypted with the deployment's
customer-managed KMS key (already granted to this Lambda's role). KMS provides
confidentiality (opacity) and authenticated encryption (tamper detection): any
modification to the ciphertext, or a mismatch in the KMS *encryption context*,
causes ``Decrypt`` to fail, which we surface as an invalid-token error. The
token is the URL-safe base64 of the ciphertext, prefixed with a format version
(``v1.``) so future formats can be introduced without ambiguity.

    token = "v1." + base64url( KMS.Encrypt(json(key), context={purpose, ...}) )

The KMS encryption context is authenticated but not secret; it never contains
the sensitive key material, only routing/binding metadata (purpose, user id).
"""

import base64
import json
import os
from typing import Any, Dict, Optional

import boto3
from aws_lambda_powertools import Logger
from boto3.dynamodb.types import TypeDeserializer, TypeSerializer

logger = Logger()

# Token format version. Bump when the on-the-wire format changes; decode rejects
# any token whose prefix it does not recognise.
TOKEN_VERSION = "v1"
_VERSION_PREFIX = f"{TOKEN_VERSION}."

# Reserved encryption-context key carrying the token's purpose (endpoint scope).
_CONTEXT_PURPOSE_KEY = "purpose"

_serializer = TypeSerializer()
_deserializer = TypeDeserializer()

# Lazily-initialised KMS client so importing this module does not require AWS
# credentials/region at import time (keeps unit tests and cold imports cheap).
_kms_client = None


class InvalidPaginationTokenError(Exception):
    """Raised when a supplied pagination token is malformed, tampered with, or
    not valid for the requested purpose. Callers should translate this into an
    HTTP 400 response."""


def _get_kms_client():
    global _kms_client
    if _kms_client is None:
        _kms_client = boto3.client("kms", region_name=os.environ.get("AWS_REGION"))
    return _kms_client


def _get_key_id() -> str:
    key_id = os.environ.get("ENCRYPTION_KEY_ARN")
    if not key_id:
        # Misconfiguration, not a client error: the env var is set by the CDK
        # construct. Surface loudly rather than silently producing weak tokens.
        raise RuntimeError("ENCRYPTION_KEY_ARN environment variable is required but not set")
    return key_id


def _build_encryption_context(purpose: str, extra_context: Optional[Dict[str, str]]) -> Dict[str, str]:
    """Compose the KMS encryption context that binds a token to its purpose and,
    optionally, to caller-specific values (e.g. the authenticated user id).

    The context is authenticated by KMS on both encrypt and decrypt: a token can
    only be decrypted by presenting the exact same context, which is how we
    prevent a token from one endpoint/user being replayed against another."""
    if not purpose:
        raise ValueError("purpose is required for pagination tokens")
    context: Dict[str, str] = {_CONTEXT_PURPOSE_KEY: purpose}
    if extra_context:
        for key, value in extra_context.items():
            if key == _CONTEXT_PURPOSE_KEY:
                raise ValueError(f"'{_CONTEXT_PURPOSE_KEY}' is reserved in the encryption context")
            # KMS encryption context values must be strings.
            context[key] = str(value)
    return context


def encode_pagination_token(
    last_evaluated_key: Dict[str, Any],
    purpose: str,
    extra_context: Optional[Dict[str, str]] = None,
) -> str:
    """Encrypt a DynamoDB ``LastEvaluatedKey`` into an opaque, versioned token.

    Args:
        last_evaluated_key: The ``LastEvaluatedKey`` from a boto3 resource-level
            query/scan response (native Python types, including ``Decimal``).
        purpose: Stable identifier for the endpoint that mints the token (for
            example ``"admin-sessions"``). Bound into the token so it cannot be
            replayed elsewhere.
        extra_context: Optional additional binding values (for example
            ``{"user_id": user_id}``) added to the KMS encryption context.

    Returns:
        A URL-safe token string of the form ``"v1.<base64url-ciphertext>"``.

    Raises:
        RuntimeError: If ``ENCRYPTION_KEY_ARN`` is not configured.
    """
    encryption_context = _build_encryption_context(purpose, extra_context)

    # Convert the resource-level key (native types, Decimals) into the DynamoDB
    # wire form so it survives a JSON round-trip without a custom encoder, then
    # serialise. This mirrors what callers previously did inline.
    serialized_key = {k: _serializer.serialize(v) for k, v in last_evaluated_key.items()}
    plaintext = json.dumps(serialized_key, separators=(",", ":")).encode("utf-8")

    response = _get_kms_client().encrypt(
        KeyId=_get_key_id(),
        Plaintext=plaintext,
        EncryptionContext=encryption_context,
    )
    ciphertext = response["CiphertextBlob"]
    encoded = base64.urlsafe_b64encode(ciphertext).decode("utf-8")
    return f"{_VERSION_PREFIX}{encoded}"


def decode_pagination_token(
    token: str,
    purpose: str,
    extra_context: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Validate and decrypt an opaque token back into a DynamoDB
    ``ExclusiveStartKey``.

    Args:
        token: The token previously produced by :func:`encode_pagination_token`.
        purpose: Must match the ``purpose`` used when the token was minted.
        extra_context: Must match the ``extra_context`` used when minting.

    Returns:
        The deserialized DynamoDB key, suitable for use as ``ExclusiveStartKey``.

    Raises:
        InvalidPaginationTokenError: If the token is empty, has an unknown
            version, is not decodable, fails KMS integrity/context validation
            (tampering or wrong purpose/user), or does not deserialize to a key.
    """
    encryption_context = _build_encryption_context(purpose, extra_context)

    if not token or not isinstance(token, str):
        raise InvalidPaginationTokenError("Pagination token is missing or not a string")

    version, sep, encoded = token.partition(".")
    if sep != "." or version != TOKEN_VERSION:
        # Unknown or missing version prefix -- refuse rather than guess a format.
        raise InvalidPaginationTokenError(f"Unsupported pagination token version: {version!r}")

    try:
        ciphertext = base64.urlsafe_b64decode(encoded.encode("utf-8"))
    except Exception as exc:
        raise InvalidPaginationTokenError("Pagination token is not valid base64") from exc

    try:
        response = _get_kms_client().decrypt(
            CiphertextBlob=ciphertext,
            EncryptionContext=encryption_context,
            # Pin the expected key so a ciphertext under any other key is rejected.
            KeyId=_get_key_id(),
        )
        plaintext = response["Plaintext"]
    except Exception as exc:
        # InvalidCiphertextException (tampering or wrong encryption context),
        # AccessDenied, etc. Do not leak details to the client.
        logger.warning(f"Pagination token failed KMS validation: {type(exc).__name__}")
        raise InvalidPaginationTokenError("Pagination token is invalid") from exc

    try:
        serialized_key = json.loads(plaintext.decode("utf-8"))
        return {k: _deserializer.deserialize(v) for k, v in serialized_key.items()}
    except Exception as exc:
        raise InvalidPaginationTokenError("Pagination token payload is malformed") from exc
