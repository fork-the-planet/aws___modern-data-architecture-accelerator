"""
Custom Resource handler for AgentCore Runtime log group protection.
Discovers service-created log groups by runtime ID and applies:
- KMS encryption via associate-kms-key
- Retention policy via put-retention-policy
- Data protection policy via put-data-protection-policy
"""

import json
import logging
import time

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

logs_client = boto3.client("logs")

LOG_GROUP_PREFIX = "/aws/bedrock-agentcore/runtimes/"
MAX_DISCOVERY_ATTEMPTS = 10
DISCOVERY_INTERVAL_SECONDS = 15


def lambda_handler(event, context):
    safe_event = {
        "RequestType": event.get("RequestType"),
        "ResourceProperties": {
            k: v for k, v in event.get("ResourceProperties", {}).items() if k != "ServiceToken"
        },
        "StackId": event.get("StackId"),
        "LogicalResourceId": event.get("LogicalResourceId"),
    }
    logger.info("Received event: %s", json.dumps(safe_event, indent=2))

    request_type = event["RequestType"]
    resource_config = event["ResourceProperties"]

    if request_type in ["Create", "Update"]:
        return handle_create_update(resource_config)
    elif request_type == "Delete":
        return handle_delete(resource_config)
    else:
        raise ValueError(f"Unexpected RequestType: {request_type}")


def handle_create_update(resource_config):
    runtime_id = resource_config["runtimeId"]
    log_groups = discover_log_groups(runtime_id)

    if not log_groups:
        raise RuntimeError(
            f"No log groups found for runtime ID '{runtime_id}' "
            f"after {MAX_DISCOVERY_ATTEMPTS} attempts"
        )

    apply_protections(log_groups, resource_config)

    return {
        "Status": "200",
        "Data": {
            "LogGroups": json.dumps(log_groups),
            "RuntimeId": runtime_id,
        },
    }


def handle_delete(resource_config):
    runtime_id = resource_config["runtimeId"]
    kms_key_arn = resource_config.get("kmsKeyArn")

    if kms_key_arn:
        log_groups = discover_log_groups(runtime_id, wait=False)
        for log_group_name in log_groups:
            disassociate_kms(log_group_name)

    return {"Status": "200", "Data": {}}


def apply_protections(log_groups, resource_config):
    kms_key_arn = resource_config.get("kmsKeyArn")
    retention_days = resource_config.get("retentionDays")
    data_protection_policy = resource_config.get("dataProtectionPolicy")

    for log_group_name in log_groups:
        if kms_key_arn:
            apply_kms_encryption(log_group_name, kms_key_arn)
        if retention_days:
            apply_retention(log_group_name, int(retention_days))
        if data_protection_policy:
            apply_data_protection(log_group_name, data_protection_policy)


def discover_log_groups(runtime_id, wait=True):
    """Discover log groups created by the AgentCore service for this runtime."""
    prefix = f"{LOG_GROUP_PREFIX}{runtime_id}"

    paginator = logs_client.get_paginator("describe_log_groups")
    for attempt in range(MAX_DISCOVERY_ATTEMPTS if wait else 1):
        log_groups = []
        for page in paginator.paginate(logGroupNamePrefix=prefix):
            log_groups.extend(lg["logGroupName"] for lg in page.get("logGroups", []))

        if log_groups:
            logger.info("Found %d log groups for runtime %s: %s", len(log_groups), runtime_id, log_groups)
            return log_groups

        if wait and attempt < MAX_DISCOVERY_ATTEMPTS - 1:
            logger.info(
                "No log groups found yet for %s (attempt %d/%d), waiting %ds...",
                runtime_id, attempt + 1, MAX_DISCOVERY_ATTEMPTS, DISCOVERY_INTERVAL_SECONDS,
            )
            time.sleep(DISCOVERY_INTERVAL_SECONDS)

    logger.warning("No log groups found for runtime %s", runtime_id)
    return []


def apply_kms_encryption(log_group_name, kms_key_arn):
    """Associate a KMS key with the log group."""
    logger.info("Associating KMS key %s with log group %s", kms_key_arn, log_group_name)
    logs_client.associate_kms_key(logGroupName=log_group_name, kmsKeyId=kms_key_arn)


def apply_retention(log_group_name, retention_days):
    """Set retention policy on the log group."""
    logger.info("Setting retention to %d days on log group %s", retention_days, log_group_name)
    logs_client.put_retention_policy(logGroupName=log_group_name, retentionInDays=retention_days)


def apply_data_protection(log_group_name, policy_json):
    """Apply data protection policy to the log group."""
    logger.info("Applying data protection policy to log group %s", log_group_name)
    policy = json.loads(policy_json) if isinstance(policy_json, str) else policy_json
    logs_client.put_data_protection_policy(
        logGroupIdentifier=log_group_name,
        policyDocument=json.dumps(policy),
    )


def disassociate_kms(log_group_name):
    """Remove KMS key association from the log group."""
    logger.info("Disassociating KMS key from log group %s", log_group_name)
    try:
        logs_client.disassociate_kms_key(logGroupName=log_group_name)
    except Exception as e:
        logger.warning("Failed to disassociate KMS from %s: %s", log_group_name, e)
