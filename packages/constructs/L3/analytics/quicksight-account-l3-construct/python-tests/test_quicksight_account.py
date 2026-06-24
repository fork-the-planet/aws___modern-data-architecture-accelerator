"""
Unit tests for quicksight_account.py module.
"""
import pytest
from unittest.mock import MagicMock, patch

# Import the module under test
import quicksight_account

from constants import test_account_name


def _event(request_type):
    return {
        'RequestType': request_type,
        'PhysicalResourceId': test_account_name,
        'ResourceProperties': {
            'accountDetail': {
                'accountName': test_account_name,
                'edition': 'ENTERPRISE',
                'authenticationMethod': 'IAM_AND_QUICKSIGHT',
                'notificationEmail': 'admin@example.com',
            }
        },
    }


class TestQuickSightAccount:
    """Test cases for quicksight_account.py module."""

    def test_lambda_handler_create_routes_to_create(self, lambda_context):
        with patch('quicksight_account.handle_create') as mock_handle:
            mock_handle.return_value = {"Status": "SUCCESS"}
            event = _event('Create')

            quicksight_account.lambda_handler(event, lambda_context)

            mock_handle.assert_called_once()

    def test_lambda_handler_update_routes_to_update(self, lambda_context):
        with patch('quicksight_account.handle_update') as mock_handle:
            mock_handle.return_value = {"Status": "SUCCESS"}
            event = _event('Update')

            quicksight_account.lambda_handler(event, lambda_context)

            mock_handle.assert_called_once()

    def test_lambda_handler_delete_routes_to_delete(self, lambda_context):
        with patch('quicksight_account.handle_delete') as mock_handle:
            mock_handle.return_value = {"Status": "SUCCESS"}
            event = _event('Delete')

            quicksight_account.lambda_handler(event, lambda_context)

            mock_handle.assert_called_once()

    def test_lambda_handler_raises_on_unsupported_request_type(self, lambda_context):
        event = _event('Bogus')

        with pytest.raises(ValueError, match='Unsupported RequestType'):
            quicksight_account.lambda_handler(event, lambda_context)

    def test_handle_create_delegates_to_create_quicksight_account(self, lambda_context):
        account_detail = _event('Create')['ResourceProperties']['accountDetail']

        with patch('quicksight_account.create_quicksight_account') as mock_create:
            mock_create.return_value = {"Status": "SUCCESS", "PhysicalResourceId": test_account_name}

            result = quicksight_account.handle_create(account_detail, lambda_context)

        mock_create.assert_called_once_with(account_detail)
        assert result["Status"] == "SUCCESS"
        assert result["PhysicalResourceId"] == test_account_name

    def test_handle_delete_is_noop_returning_success(self, lambda_context):
        """Delete must not tear down the billed account subscription."""
        account_detail = _event('Delete')['ResourceProperties']['accountDetail']

        with patch('quicksight_account.quicksight_client') as mock_client:
            result = quicksight_account.handle_delete(account_detail, lambda_context)

        assert not mock_client.delete_account_subscription.called
        assert result["Status"] == "SUCCESS"
        assert result["PhysicalResourceId"] == test_account_name

    def test_handle_update_is_noop_returning_success_and_warns(self, lambda_context):
        """Update is a no-op but must WARN that config changes were not applied."""
        account_detail = _event('Update')['ResourceProperties']['accountDetail']

        with patch('quicksight_account.quicksight_client') as mock_client, \
             patch('quicksight_account.logger') as mock_logger:
            result = quicksight_account.handle_update(account_detail, lambda_context)

        # No subscription mutation is attempted
        assert not mock_client.update_account_subscription.called
        assert result["Status"] == "SUCCESS"
        assert result["PhysicalResourceId"] == test_account_name
        # The operator must be warned the change was not applied
        mock_logger.warning.assert_called_once()

    def test_handle_create_waits_for_account_created(self, lambda_context):
        account_detail = _event('Create')['ResourceProperties']['accountDetail']

        mock_client = MagicMock()
        mock_client.create_account_subscription.return_value = {}
        mock_client.describe_account_subscription.return_value = {
            'AccountInfo': {'AccountSubscriptionStatus': 'ACCOUNT_CREATED'}
        }

        with patch('quicksight_account.quicksight_client', mock_client), \
             patch('quicksight_account.time.sleep'):
            result = quicksight_account.create_quicksight_account(account_detail)

        mock_client.create_account_subscription.assert_called_once()
        assert result["Status"] == "SUCCESS"
        assert result["PhysicalResourceId"] == test_account_name

    def test_handle_create_raises_on_failed_status(self, lambda_context):
        account_detail = _event('Create')['ResourceProperties']['accountDetail']

        mock_client = MagicMock()
        mock_client.create_account_subscription.return_value = {}
        mock_client.describe_account_subscription.return_value = {
            'AccountInfo': {'AccountSubscriptionStatus': 'ACCOUNT_CREATION_FAILED'}
        }

        with patch('quicksight_account.quicksight_client', mock_client), \
             patch('quicksight_account.time.sleep'):
            with pytest.raises(Exception, match="QuickSight account creation failed"):
                quicksight_account.create_quicksight_account(account_detail)
