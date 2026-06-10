"""Tests for AgentCore Log Protection custom resource handler."""
import pytest
import json
from unittest.mock import patch, MagicMock
import log_protection


def _mock_paginator(mock_client, pages_sequence):
    """Helper to mock get_paginator for describe_log_groups.

    pages_sequence: list of lists-of-pages. Each outer item is one paginate() call.
    e.g. [[{'logGroups': []}], [{'logGroups': [{'logGroupName': 'x'}]}]]
    means first paginate() returns one page with no groups, second returns one page with one group.
    """
    paginator = MagicMock()
    paginator.paginate.side_effect = pages_sequence
    mock_client.get_paginator.return_value = paginator
    return paginator


TEST_RUNTIME_ID = 'my_org_dev__749d67db-QQHgbo7Noj'
TEST_KMS_KEY_ARN = 'arn:aws:kms:us-east-2:123456789012:key/test-key-id'
TEST_LOG_GROUP_DEFAULT = f'/aws/bedrock-agentcore/runtimes/{TEST_RUNTIME_ID}-DEFAULT'
TEST_LOG_GROUP_ENDPOINT = f'/aws/bedrock-agentcore/runtimes/{TEST_RUNTIME_ID}-endpoint123'


@patch('log_protection.logs_client')
def test_create_discovers_and_protects_log_groups(mock_client, aws_credentials, lambda_context):
    """Test Create discovers log groups and applies protections."""
    _mock_paginator(mock_client, [
        [{'logGroups': [
            {'logGroupName': TEST_LOG_GROUP_DEFAULT},
            {'logGroupName': TEST_LOG_GROUP_ENDPOINT},
        ]}],
    ])

    policy = json.dumps({'Name': 'test', 'Version': '2021-06-01', 'Statement': []})
    event = {
        'RequestType': 'Create',
        'ResourceProperties': {
            'runtimeId': TEST_RUNTIME_ID,
            'kmsKeyArn': TEST_KMS_KEY_ARN,
            'retentionDays': '90',
            'dataProtectionPolicy': policy,
        },
    }

    result = log_protection.lambda_handler(event, lambda_context)

    assert result['Status'] == '200'
    assert mock_client.associate_kms_key.call_count == 2
    assert mock_client.put_retention_policy.call_count == 2
    assert mock_client.put_data_protection_policy.call_count == 2

    mock_client.associate_kms_key.assert_any_call(
        logGroupName=TEST_LOG_GROUP_DEFAULT, kmsKeyId=TEST_KMS_KEY_ARN
    )
    mock_client.put_retention_policy.assert_any_call(
        logGroupName=TEST_LOG_GROUP_DEFAULT, retentionInDays=90
    )


@patch('log_protection.logs_client')
def test_create_without_kms_skips_encryption(mock_client, aws_credentials, lambda_context):
    """Test Create without kmsKeyArn skips associate_kms_key."""
    _mock_paginator(mock_client, [
        [{'logGroups': [{'logGroupName': TEST_LOG_GROUP_DEFAULT}]}],
    ])

    event = {
        'RequestType': 'Create',
        'ResourceProperties': {
            'runtimeId': TEST_RUNTIME_ID,
            'retentionDays': '30',
        },
    }

    result = log_protection.lambda_handler(event, lambda_context)

    assert result['Status'] == '200'
    mock_client.associate_kms_key.assert_not_called()
    mock_client.put_retention_policy.assert_called_once()


@patch('log_protection.logs_client')
@patch('log_protection.time.sleep')
def test_create_retries_discovery(mock_sleep, mock_client, aws_credentials, lambda_context):
    """Test Create retries when log groups are not immediately available."""
    _mock_paginator(mock_client, [
        [{'logGroups': []}],
        [{'logGroups': []}],
        [{'logGroups': [{'logGroupName': TEST_LOG_GROUP_DEFAULT}]}],
    ])

    event = {
        'RequestType': 'Create',
        'ResourceProperties': {
            'runtimeId': TEST_RUNTIME_ID,
            'kmsKeyArn': TEST_KMS_KEY_ARN,
        },
    }

    result = log_protection.lambda_handler(event, lambda_context)

    assert result['Status'] == '200'
    paginator = mock_client.get_paginator.return_value
    assert paginator.paginate.call_count == 3
    assert mock_sleep.call_count == 2
    mock_client.associate_kms_key.assert_called_once()


@patch('log_protection.logs_client')
@patch('log_protection.time.sleep')
def test_create_raises_when_no_log_groups_found(mock_sleep, mock_client, aws_credentials, lambda_context):
    """Test Create raises RuntimeError after max retries with no log groups."""
    paginator = MagicMock()
    paginator.paginate.return_value = [{'logGroups': []}]
    mock_client.get_paginator.return_value = paginator

    event = {
        'RequestType': 'Create',
        'ResourceProperties': {
            'runtimeId': TEST_RUNTIME_ID,
            'kmsKeyArn': TEST_KMS_KEY_ARN,
        },
    }

    with pytest.raises(RuntimeError, match="No log groups found"):
        log_protection.lambda_handler(event, lambda_context)


@patch('log_protection.logs_client')
def test_delete_disassociates_kms(mock_client, aws_credentials, lambda_context):
    """Test Delete disassociates KMS key from discovered log groups."""
    _mock_paginator(mock_client, [
        [{'logGroups': [{'logGroupName': TEST_LOG_GROUP_DEFAULT}]}],
    ])

    event = {
        'RequestType': 'Delete',
        'ResourceProperties': {
            'runtimeId': TEST_RUNTIME_ID,
            'kmsKeyArn': TEST_KMS_KEY_ARN,
        },
    }

    result = log_protection.lambda_handler(event, lambda_context)

    assert result['Status'] == '200'
    mock_client.disassociate_kms_key.assert_called_once_with(logGroupName=TEST_LOG_GROUP_DEFAULT)


@patch('log_protection.logs_client')
def test_delete_handles_missing_log_group(mock_client, aws_credentials, lambda_context):
    """Test Delete gracefully handles exceptions."""
    _mock_paginator(mock_client, [
        [{'logGroups': [{'logGroupName': TEST_LOG_GROUP_DEFAULT}]}],
    ])
    mock_client.disassociate_kms_key.side_effect = Exception("ResourceNotFoundException")

    event = {
        'RequestType': 'Delete',
        'ResourceProperties': {
            'runtimeId': TEST_RUNTIME_ID,
            'kmsKeyArn': TEST_KMS_KEY_ARN,
        },
    }

    result = log_protection.lambda_handler(event, lambda_context)
    assert result['Status'] == '200'


def test_unexpected_request_type_raises(aws_credentials, lambda_context):
    """Test unexpected RequestType raises ValueError."""
    event = {
        'RequestType': 'Invalid',
        'ResourceProperties': {
            'runtimeId': TEST_RUNTIME_ID,
        },
    }

    with pytest.raises(ValueError, match="Unexpected RequestType: Invalid"):
        log_protection.lambda_handler(event, lambda_context)


@patch('log_protection.logs_client')
def test_update_behaves_like_create(mock_client, aws_credentials, lambda_context):
    """Test Update applies protections same as Create."""
    _mock_paginator(mock_client, [
        [{'logGroups': [{'logGroupName': TEST_LOG_GROUP_DEFAULT}]}],
    ])

    event = {
        'RequestType': 'Update',
        'ResourceProperties': {
            'runtimeId': TEST_RUNTIME_ID,
            'kmsKeyArn': TEST_KMS_KEY_ARN,
        },
    }

    result = log_protection.lambda_handler(event, lambda_context)

    assert result['Status'] == '200'
    mock_client.associate_kms_key.assert_called_once()
