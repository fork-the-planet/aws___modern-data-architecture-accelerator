"""
Custom Resource handler for AgentCore resource-based policies.
Calls PutResourcePolicy on Create/Update and DeleteResourcePolicy on Delete.
"""

import json
import logging

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client = boto3.client("bedrock-agentcore-control")


def lambda_handler(event, context):
    logger.info("Received event: %s", json.dumps(event, indent=2))

    resource_config = event["ResourceProperties"]
    resource_arn = resource_config["resourceArn"]
    policy = resource_config["policy"]

    request_type = event["RequestType"]

    if request_type in ["Create", "Update"]:
        logger.info("Putting resource policy on %s", resource_arn)
        client.put_resource_policy(
            resourceArn=resource_arn,
            policy=policy,
        )
        return {"Status": "200", "Data": {"ResourceArn": resource_arn}}

    elif request_type == "Delete":
        logger.info("Deleting resource policy from %s", resource_arn)
        try:
            client.delete_resource_policy(resourceArn=resource_arn)
        except client.exceptions.ResourceNotFoundException:
            logger.info("Resource policy already deleted or not found, skipping")
        return {"Status": "200", "Data": {}}

    else:
        raise ValueError(f"Unexpected RequestType: {request_type}")
