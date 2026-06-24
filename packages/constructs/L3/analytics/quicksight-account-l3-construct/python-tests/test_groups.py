"""
Unit tests for groups.py module.
"""
import pytest
from unittest.mock import MagicMock, patch, call
from botocore.exceptions import ClientError

# Import the module under test
import groups

from constants import test_account_id


def _create_event(group_names):
    return {
        'RequestType': 'Create',
        'PhysicalResourceId': f"{test_account_id}-qs-groups",
        'ResourceProperties': {
            'accountId': test_account_id,
            'groups': group_names,
        },
    }


class TestGroups:
    """Test cases for groups.py module."""

    def test_lambda_handler_create_routes_to_create_update(self, lambda_context):
        with patch('groups.handle_create_update') as mock_handle:
            mock_handle.return_value = {"Status": "SUCCESS"}
            event = _create_event(['readers'])

            groups.lambda_handler(event, lambda_context)

            mock_handle.assert_called_once_with(event, lambda_context)

    def test_lambda_handler_update_routes_to_create_update(self, lambda_context):
        with patch('groups.handle_create_update') as mock_handle:
            mock_handle.return_value = {"Status": "SUCCESS"}
            event = _create_event(['readers'])
            event['RequestType'] = 'Update'

            groups.lambda_handler(event, lambda_context)

            mock_handle.assert_called_once_with(event, lambda_context)

    def test_lambda_handler_delete_routes_to_delete(self, lambda_context):
        with patch('groups.handle_delete') as mock_handle:
            mock_handle.return_value = {"Status": "SUCCESS"}
            event = _create_event(['readers'])
            event['RequestType'] = 'Delete'

            groups.lambda_handler(event, lambda_context)

            mock_handle.assert_called_once_with(event, lambda_context)

    def test_lambda_handler_raises_on_unsupported_request_type(self, lambda_context):
        event = _create_event(['readers'])
        event['RequestType'] = 'Bogus'

        with pytest.raises(ValueError, match='Unsupported RequestType'):
            groups.lambda_handler(event, lambda_context)

    def test_handle_create_update_creates_each_group(self, lambda_context):
        event = _create_event(['readers', 'authors'])
        mock_qs = MagicMock()
        mock_qs.exceptions.ResourceExistsException = ClientError

        with patch('groups._identity_region', return_value='us-east-1'), \
             patch('groups.boto3.client', return_value=mock_qs):
            result = groups.handle_create_update(event, lambda_context)

        assert mock_qs.create_group.call_count == 2
        mock_qs.create_group.assert_any_call(
            AwsAccountId=test_account_id, Namespace='default', GroupName='readers'
        )
        mock_qs.create_group.assert_any_call(
            AwsAccountId=test_account_id, Namespace='default', GroupName='authors'
        )
        assert result["Status"] == "SUCCESS"
        assert result["PhysicalResourceId"] == f"{test_account_id}-qs-groups"

    def test_handle_create_update_is_idempotent_on_existing_group(self, lambda_context):
        """A group that already exists must not fail the custom resource."""
        event = _create_event(['readers'])

        class ResourceExists(Exception):
            pass

        mock_qs = MagicMock()
        mock_qs.exceptions.ResourceExistsException = ResourceExists
        mock_qs.create_group.side_effect = ResourceExists("already exists")

        with patch('groups._identity_region', return_value='us-east-1'), \
             patch('groups.boto3.client', return_value=mock_qs):
            result = groups.handle_create_update(event, lambda_context)

        assert result["Status"] == "SUCCESS"

    def test_handle_create_update_empty_groups(self, lambda_context):
        event = _create_event([])
        mock_qs = MagicMock()

        with patch('groups._identity_region', return_value='us-east-1'), \
             patch('groups.boto3.client', return_value=mock_qs):
            result = groups.handle_create_update(event, lambda_context)

        mock_qs.create_group.assert_not_called()
        assert result["Status"] == "SUCCESS"

    def test_handle_delete_does_not_delete_groups(self, lambda_context):
        event = _create_event(['readers'])
        event['RequestType'] = 'Delete'

        with patch('groups.quicksight_client') as mock_client:
            result = groups.handle_delete(event, lambda_context)

        # Groups are intentionally preserved on stack removal
        assert not mock_client.delete_group.called
        assert result["Status"] == "SUCCESS"
        assert result["PhysicalResourceId"] == f"{test_account_id}-qs-groups"

    def test_identity_region_returns_current_region_on_success(self):
        mock_client = MagicMock()
        mock_client.meta.region_name = 'us-east-1'
        mock_client.describe_account_settings.return_value = {}

        with patch('groups.quicksight_client', mock_client):
            assert groups._identity_region(test_account_id) == 'us-east-1'

    def test_identity_region_parsed_from_error_message(self):
        mock_client = MagicMock()
        mock_client.meta.region_name = 'us-west-2'
        mock_client.describe_account_settings.side_effect = Exception(
            "Operation is being called from a region other than the identity region is eu-west-1"
        )

        with patch('groups.quicksight_client', mock_client):
            assert groups._identity_region(test_account_id) == 'eu-west-1'

    def test_identity_region_falls_back_when_unparseable(self):
        mock_client = MagicMock()
        mock_client.meta.region_name = 'ap-southeast-2'
        mock_client.describe_account_settings.side_effect = Exception("totally unrelated error")

        with patch('groups.quicksight_client', mock_client):
            assert groups._identity_region(test_account_id) == 'ap-southeast-2'
