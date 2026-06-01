"""Tests for AgentCore Resource Policy custom resource handler."""
import pytest
import json
from unittest.mock import patch, MagicMock
import resource_policy


@patch('resource_policy.client')
def test_create_puts_resource_policy(mock_client, aws_credentials, lambda_context):
    """Test Create request calls put_resource_policy."""
    policy_doc = json.dumps({"Version": "2012-10-17", "Statement": []})
    event = {
        'RequestType': 'Create',
        'ResourceProperties': {
            'resourceArn': 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-runtime',
            'policy': policy_doc,
        },
    }

    result = resource_policy.lambda_handler(event, lambda_context)

    mock_client.put_resource_policy.assert_called_once_with(
        resourceArn='arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-runtime',
        policy=policy_doc,
    )
    assert result['Status'] == '200'
    assert result['Data']['ResourceArn'] == 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-runtime'


@patch('resource_policy.client')
def test_update_puts_resource_policy(mock_client, aws_credentials, lambda_context):
    """Test Update request calls put_resource_policy (same as Create)."""
    policy_doc = json.dumps({"Version": "2012-10-17", "Statement": []})
    event = {
        'RequestType': 'Update',
        'ResourceProperties': {
            'resourceArn': 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-runtime',
            'policy': policy_doc,
        },
    }

    result = resource_policy.lambda_handler(event, lambda_context)

    mock_client.put_resource_policy.assert_called_once_with(
        resourceArn='arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-runtime',
        policy=policy_doc,
    )
    assert result['Status'] == '200'


@patch('resource_policy.client')
def test_delete_removes_resource_policy(mock_client, aws_credentials, lambda_context):
    """Test Delete request calls delete_resource_policy."""
    event = {
        'RequestType': 'Delete',
        'ResourceProperties': {
            'resourceArn': 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-runtime',
            'policy': '{}',
        },
    }

    result = resource_policy.lambda_handler(event, lambda_context)

    mock_client.delete_resource_policy.assert_called_once_with(
        resourceArn='arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-runtime',
    )
    assert result['Status'] == '200'


@patch('resource_policy.client')
def test_delete_handles_resource_not_found(mock_client, aws_credentials, lambda_context):
    """Test Delete gracefully handles ResourceNotFoundException."""
    mock_client.exceptions.ResourceNotFoundException = type('ResourceNotFoundException', (Exception,), {})
    mock_client.delete_resource_policy.side_effect = mock_client.exceptions.ResourceNotFoundException()

    event = {
        'RequestType': 'Delete',
        'ResourceProperties': {
            'resourceArn': 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-runtime',
            'policy': '{}',
        },
    }

    result = resource_policy.lambda_handler(event, lambda_context)

    assert result['Status'] == '200'


def test_unexpected_request_type_raises(aws_credentials, lambda_context):
    """Test unexpected RequestType raises ValueError."""
    event = {
        'RequestType': 'Invalid',
        'ResourceProperties': {
            'resourceArn': 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-runtime',
            'policy': '{}',
        },
    }

    with pytest.raises(ValueError, match="Unexpected RequestType: Invalid"):
        resource_policy.lambda_handler(event, lambda_context)