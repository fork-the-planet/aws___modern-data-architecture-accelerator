# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging
import boto3
import time
import json
import os
import sys
from botocore.config import Config

solution_identifier = os.getenv("USER_AGENT_STRING")
# Explicit timeouts prevent the Lambda from hanging on a stalled QuickSight API call.
boto_config = Config(
    user_agent_extra=solution_identifier,
    connect_timeout=10,
    read_timeout=30,
    retries={"max_attempts": 3},
)

# Prepend the bundled boto3 layer location so the custom boto3 version is importable.
# NOTE: path string preserved verbatim from the original implementation to avoid changing
# runtime sys.path resolution behavior.
env_lambda_task_root = '/var/task'
sys.path.insert(0, env_lambda_task_root + "/quicksight_acount")

quicksight_client = boto3.client('quicksight', config=boto_config)

logging.basicConfig(
    format="%(name)s: %(asctime)s | %(levelname)s | %(filename)s:%(lineno)s | %(process)d >>> %(message)s | Function: %(funcName)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    level=os.environ.get('LOG_LEVEL', 'INFO').upper()
)
logger = logging.getLogger("Quicksight account")

ACCOUNT_ID = os.environ["ACCOUNT_ID"]


def lambda_handler(event, context):
    logger.debug(json.dumps(event, indent=2))
    resource_config = event['ResourceProperties']
    account_detail = resource_config['accountDetail']
    request_type = event['RequestType']
    if request_type == 'Create':
        return handle_create(account_detail, context)
    if request_type == 'Update':
        return handle_update(account_detail, context)
    if request_type == 'Delete':
        return handle_delete(account_detail, context)
    raise ValueError(f"Unsupported RequestType: {request_type}")


def handle_create(account_detail, context):
    logger.info("**Starting running the QuickSight Account Setup")
    logger.info("**Creating quicksight account")
    response_data = create_quicksight_account(account_detail)
    return response_data


def handle_delete(account_detail, context):
    logger.info('Received delete event, Account will not be deleted')
    response_data = {
        "Status": "SUCCESS",
        "PhysicalResourceId": account_detail.get('accountName')
    }
    return response_data


def handle_update(account_detail, context):
    # The QuickSight account subscription cannot be modified in place via this
    # custom resource (edition, notification email, etc. are console/billing
    # operations). Report success so the stack does not roll back, but WARN
    # loudly so the operator knows the config change was NOT applied.
    logger.warning(
        "Received update event. The QuickSight account subscription is not "
        "updated in place; changes to accountDetail (e.g. edition, "
        "notificationEmail) were NOT applied and must be made in the QuickSight "
        "console if required."
    )
    response_data = {
        "Status": "SUCCESS",
        "PhysicalResourceId": account_detail.get('accountName')
    }
    return response_data


def create_quicksight_account(account_detail):
    response = quicksight_client.create_account_subscription(
        Edition=account_detail.get('edition'),
        AuthenticationMethod=account_detail.get('authenticationMethod'),
        AwsAccountId=ACCOUNT_ID,
        AccountName=account_detail.get('accountName',),
        NotificationEmail=account_detail.get('notificationEmail', ""),
        FirstName=account_detail.get('firstName', ""),
        LastName=account_detail.get('lastName', ""),
        EmailAddress=account_detail.get('emailAddress', ""),
        ContactNumber=account_detail.get('contactNumber', "")
    )
    logger.debug(json.dumps(response, indent=2))
    # nosemgrep
    time.sleep(30)
    created = False
    while not created:
        response = quicksight_client.describe_account_subscription(
            AwsAccountId=ACCOUNT_ID
        )
        logger.info(json.dumps(response, indent=2))
        # nosemgrep
        time.sleep(30)
        if response['AccountInfo']['AccountSubscriptionStatus'] == 'ACCOUNT_CREATED':
            created = True
        else:
            reason = response['AccountInfo']['AccountSubscriptionStatus']
            logger.info("**QuickSight account creation failed with: %s", reason)
            raise RuntimeError(f"QuickSight account creation failed with: {reason}.")
    logger.info("**QuickSight Account created successfully: %s", account_detail)
    response_data = {
        "Status": "SUCCESS",
        "PhysicalResourceId": account_detail.get('accountName')
    }
    return response_data
