# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import logging
import os
import re
import boto3
import json
from botocore.config import Config

solution_identifier = os.getenv("USER_AGENT_STRING")
# Explicit timeouts prevent the Lambda from hanging on a stalled QuickSight API call.
boto_config = Config(
    user_agent_extra=solution_identifier,
    connect_timeout=10,
    read_timeout=30,
    retries={"max_attempts": 3},
)
quicksight_client = boto3.client('quicksight', config=boto_config)

logging.basicConfig(
    format="%(name)s: %(asctime)s | %(levelname)s | %(filename)s:%(lineno)s | %(process)d >>> %(message)s | Function: %(funcName)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    level=os.environ.get('LOG_LEVEL', 'INFO').upper()
)
logger = logging.getLogger("QuickSight Groups")


def lambda_handler(event, context):
    logger.debug(json.dumps(event, indent=2))

    request_type = event['RequestType']
    if request_type in ('Create', 'Update'):
        return handle_create_update(event, context)
    if request_type == 'Delete':
        return handle_delete(event, context)
    raise ValueError(f"Unsupported RequestType: {request_type}")


def _identity_region(account_id):
    # QuickSight group management must use the identity region (where QuickSight was originally
    # subscribed), which may differ from the Lambda's region. The API surfaces the identity region
    # in the error message when called from the wrong region; default to the current region.
    current_region = quicksight_client.meta.region_name
    try:
        quicksight_client.describe_account_settings(AwsAccountId=account_id)
        return current_region
    except Exception as e:  # nosemgrep
        # The QuickSight API reports the correct identity region in the error message when
        # called from the wrong region; parse it out and fall back to the current region.
        match = re.search(r'identity region is ([a-z0-9-]+)', str(e))
        if match:
            return match.group(1)
        logger.warning(
            "Could not determine QuickSight identity region from API response; "
            "falling back to current region %s. Error: %s", current_region, e
        )
        return current_region


def handle_create_update(event, context):
    resource_config = event['ResourceProperties']
    account_id = resource_config['accountId']
    groups = resource_config.get('groups', [])

    identity_region = _identity_region(account_id)
    logger.info("Using QuickSight identity region: %s", identity_region)
    # NOSONAR python:S6243 - this client must bind to the identity region resolved at runtime,
    # so it cannot be hoisted to module scope like the module-level quicksight_client.
    qs = boto3.client('quicksight', region_name=identity_region, config=boto_config)

    for group_name in groups:
        logger.info("Ensuring QuickSight group exists: %s", group_name)
        try:
            qs.create_group(
                AwsAccountId=account_id,
                Namespace='default',
                GroupName=group_name
            )
            logger.info("Created group: %s", group_name)
        except qs.exceptions.ResourceExistsException:
            logger.info("Group already exists: %s", group_name)

    return {
        "Status": "SUCCESS",
        "PhysicalResourceId": f"{account_id}-qs-groups"
    }


def handle_delete(event, context):
    # Groups are not deleted on stack removal; they may own assets and be shared across deployments.
    logger.info("Received delete event, QuickSight groups will not be deleted")
    return {
        "Status": "SUCCESS",
        "PhysicalResourceId": event['PhysicalResourceId']
    }
