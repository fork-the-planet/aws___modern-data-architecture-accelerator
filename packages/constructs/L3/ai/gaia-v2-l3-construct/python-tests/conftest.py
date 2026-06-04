"""
Shared pytest fixtures and path setup for the GAIA v2 L3 construct Python tests.

The tests exercise three separate Lambda source trees inside lib/. Each tree is
added to sys.path here so the tests can import their target modules by name
(for example ``from routes.feedback import submit_feedback``).
"""

import os
import sys

import boto3
import pytest
from moto import mock_aws

# Set AWS region before any boto3 imports to avoid NoRegionError during module load.
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_PACKAGE_ROOT = os.path.abspath(os.path.join(_THIS_DIR, ".."))

# Lambda source roots that the tests import from.
_LAMBDA_SOURCE_PATHS = [
    os.path.join(_PACKAGE_ROOT, "lib", "chatbot-api", "rest-api", "function", "api-handler"),
    os.path.join(_PACKAGE_ROOT, "lib", "chatbot-api", "websocket-api", "datasource", "layer", "python"),
    os.path.join(_PACKAGE_ROOT, "lib", "function"),
]

for path in _LAMBDA_SOURCE_PATHS:
    if path not in sys.path:
        sys.path.insert(0, path)


@pytest.fixture
def kms_pagination(monkeypatch):
    """Wire the pagination utility to a moto-backed KMS key.

    Yields the imported ``utils.pagination`` module so tests can mint real opaque
    tokens. The module's cached KMS client is reset so it binds to the moto
    backend, and ENCRYPTION_KEY_ARN is set for the duration of the test. Any test
    in the REST API handler suite that drives a code path which encodes or decodes
    a pagination token must request this fixture.
    """
    with mock_aws():
        monkeypatch.setenv("AWS_REGION", "us-east-1")
        kms = boto3.client("kms", region_name="us-east-1")
        key_arn = kms.create_key(Description="gaia-v2-pagination-test-key")["KeyMetadata"]["Arn"]
        monkeypatch.setenv("ENCRYPTION_KEY_ARN", key_arn)

        import utils.pagination as pagination

        # Bind the lazily-created client to the moto backend for this test.
        pagination._kms_client = None
        try:
            yield pagination
        finally:
            # Drop the moto-bound client so it can't leak into a later test that
            # runs outside this mock_aws context.
            pagination._kms_client = None
