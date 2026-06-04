"""
Unit tests for the opaque, versioned pagination token utility.

These tests verify the security properties the token mechanism exists to
provide (per AWS pagination-token guidance):

- **Opacity**: the encoded token does not reveal the DynamoDB key structure.
- **Versioning**: tokens carry a recognised version prefix; unknown versions
  are rejected rather than mis-parsed.
- **Integrity**: tampered ciphertext is rejected.
- **Purpose/identity binding**: a token minted for one purpose (or user) cannot
  be decoded under another, preventing cross-endpoint/cross-user replay.

KMS is exercised through moto, which faithfully enforces encryption-context
mismatches and ciphertext tampering as InvalidCiphertextException.
"""

import base64
import json
from decimal import Decimal

import pytest


KEY_ENV_VAR = "ENCRYPTION_KEY_ARN"


@pytest.fixture
def pagination(kms_pagination):
    """The pagination module wired to a moto-backed KMS key.

    Delegates to the shared ``kms_pagination`` fixture in conftest.py. We must NOT
    reload the module here: ``routes.sessions``/``routes.feedback`` bind
    ``InvalidPaginationTokenError`` at import time via ``from utils.pagination
    import ...``; reloading would create a new class object and break those
    ``except`` clauses in later tests within the same session.
    """
    return kms_pagination


# A representative LastEvaluatedKey as returned by a boto3 resource-level query,
# including a Decimal (DynamoDB numbers deserialize to Decimal).
SAMPLE_KEY = {
    "PK": "44286498-f0c1-70b8-cffb-f780cdf30344",
    "SK": "CONV#0521bf91-f782-4bfe-a0ca-9eb3b88a322d",
    "GSI1PK": "SESSION",
    "DateModified": Decimal("1775667912"),
}


class TestRoundTrip:
    def test_encode_then_decode_returns_original_key(self, pagination):
        token = pagination.encode_pagination_token(SAMPLE_KEY, purpose="admin-sessions")
        decoded = pagination.decode_pagination_token(token, purpose="admin-sessions")
        assert decoded == SAMPLE_KEY

    def test_decimal_survives_round_trip(self, pagination):
        token = pagination.encode_pagination_token(SAMPLE_KEY, purpose="admin-sessions")
        decoded = pagination.decode_pagination_token(token, purpose="admin-sessions")
        assert decoded["DateModified"] == Decimal("1775667912")
        assert isinstance(decoded["DateModified"], Decimal)

    def test_round_trip_with_extra_context(self, pagination):
        ctx = {"user_id": "user-123"}
        token = pagination.encode_pagination_token(
            SAMPLE_KEY, purpose="user-feedback-history", extra_context=ctx
        )
        decoded = pagination.decode_pagination_token(
            token, purpose="user-feedback-history", extra_context=ctx
        )
        assert decoded == SAMPLE_KEY


class TestVersioning:
    def test_token_has_version_prefix(self, pagination):
        token = pagination.encode_pagination_token(SAMPLE_KEY, purpose="admin-sessions")
        assert token.startswith("v1.")

    def test_unknown_version_is_rejected(self, pagination):
        token = pagination.encode_pagination_token(SAMPLE_KEY, purpose="admin-sessions")
        _, _, body = token.partition(".")
        forged = f"v2.{body}"
        with pytest.raises(pagination.InvalidPaginationTokenError):
            pagination.decode_pagination_token(forged, purpose="admin-sessions")

    def test_missing_version_prefix_is_rejected(self, pagination):
        with pytest.raises(pagination.InvalidPaginationTokenError):
            pagination.decode_pagination_token("no-version-here", purpose="admin-sessions")


class TestOpacity:
    def test_token_does_not_expose_key_structure(self, pagination):
        token = pagination.encode_pagination_token(SAMPLE_KEY, purpose="admin-sessions")

        # The token is "v1." + base64url(ciphertext). The only thing a client can
        # do without the KMS key is base64-decode the body, so opacity must be
        # asserted against those decoded *bytes* -- never against the base64 text.
        # base64url's 64-symbol alphabet makes a 2-char fragment such as "PK"/"SK"
        # appear in the encoded text by chance ~7% of runs each: a flaky non-signal
        # that says nothing about whether the plaintext key actually leaked.
        _, _, body = token.partition(".")
        raw = base64.urlsafe_b64decode(body.encode("utf-8"))

        # No distinctive plaintext attribute name or value survives into the
        # ciphertext. The structural attribute names and the full PK/SK values are
        # long enough that a chance byte-collision is not a practical concern
        # (unlike the 2-letter "PK"/"SK" names, which carry no opacity signal).
        for marker in (
            "GSI1PK", "SESSION", "DateModified", "CONV#",
            SAMPLE_KEY["PK"], SAMPLE_KEY["SK"],
        ):
            assert marker.encode("utf-8") not in raw

        # And the body must NOT be a reversible encoding of the key (this is
        # exactly the weakness of the previous base64-only implementation).
        with pytest.raises((UnicodeDecodeError, json.JSONDecodeError, ValueError)):
            json.loads(raw.decode("utf-8"))


class TestIntegrityAndBinding:
    def test_tampered_token_is_rejected(self, pagination):
        token = pagination.encode_pagination_token(SAMPLE_KEY, purpose="admin-sessions")
        prefix, _, body = token.partition(".")
        raw = bytearray(base64.urlsafe_b64decode(body.encode("utf-8")))
        raw[-1] ^= 0xFF  # flip the last byte of the ciphertext
        tampered = f"{prefix}.{base64.urlsafe_b64encode(bytes(raw)).decode('utf-8')}"
        with pytest.raises(pagination.InvalidPaginationTokenError):
            pagination.decode_pagination_token(tampered, purpose="admin-sessions")

    def test_token_bound_to_purpose_cannot_cross_endpoints(self, pagination):
        token = pagination.encode_pagination_token(SAMPLE_KEY, purpose="admin-sessions")
        with pytest.raises(pagination.InvalidPaginationTokenError):
            pagination.decode_pagination_token(token, purpose="admin-feedback")

    def test_token_bound_to_user_cannot_be_replayed_by_another(self, pagination):
        token = pagination.encode_pagination_token(
            SAMPLE_KEY,
            purpose="user-feedback-history",
            extra_context={"user_id": "user-A"},
        )
        with pytest.raises(pagination.InvalidPaginationTokenError):
            pagination.decode_pagination_token(
                token,
                purpose="user-feedback-history",
                extra_context={"user_id": "user-B"},
            )

    def test_garbage_token_is_rejected(self, pagination):
        with pytest.raises(pagination.InvalidPaginationTokenError):
            pagination.decode_pagination_token("v1.!!!not-base64!!!", purpose="admin-sessions")

    def test_decrypts_but_not_a_key_is_rejected(self, pagination):
        """A token that decrypts successfully but whose payload is not a
        serialized DynamoDB key is rejected (defense in depth against a payload
        that passed integrity checks but cannot be deserialized)."""
        # Encrypt a valid-but-wrong payload under the correct key + context so it
        # passes KMS decryption, then fails deserialization.
        ciphertext = pagination._get_kms_client().encrypt(
            KeyId=pagination._get_key_id(),
            Plaintext=b'"a-bare-string-not-a-key-map"',
            EncryptionContext={"purpose": "admin-sessions"},
        )["CiphertextBlob"]
        token = "v1." + base64.urlsafe_b64encode(ciphertext).decode("utf-8")
        with pytest.raises(pagination.InvalidPaginationTokenError):
            pagination.decode_pagination_token(token, purpose="admin-sessions")

    def test_empty_token_is_rejected(self, pagination):
        with pytest.raises(pagination.InvalidPaginationTokenError):
            pagination.decode_pagination_token("", purpose="admin-sessions")


class TestConfigAndContext:
    def test_missing_key_env_var_raises_runtime_error(self, pagination, monkeypatch):
        monkeypatch.delenv(KEY_ENV_VAR, raising=False)
        with pytest.raises(RuntimeError):
            pagination.encode_pagination_token(SAMPLE_KEY, purpose="admin-sessions")

    def test_empty_purpose_is_rejected(self, pagination):
        with pytest.raises(ValueError):
            pagination.encode_pagination_token(SAMPLE_KEY, purpose="")

    def test_reserved_context_key_is_rejected(self, pagination):
        with pytest.raises(ValueError):
            pagination.encode_pagination_token(
                SAMPLE_KEY, purpose="admin-sessions", extra_context={"purpose": "x"}
            )


if __name__ == "__main__":
    pytest.main([__file__])
