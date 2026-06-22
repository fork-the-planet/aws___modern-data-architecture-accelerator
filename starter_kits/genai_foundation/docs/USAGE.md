# Usage

## Deployed Resources

Once deployed, you should see the following in your AWS account(s):

**Naming convention:** `<org>-<env>-<domain>-<module>-<resource>`

**SSM parameters:** `/<org>/<domain>/<module>/<resource-type>/<resource-name>/<attribute>`

| Resource | Deployed Name / SSM Path | Config Reference |
|----------|--------------------------|------------------|
| Bedrock Agent | `<org>-dev-genai-customer-support-agent-customer-support-agent`<br>`/<org>/genai/customer-support-agent/agent/customer-support-agent/name` | `customer-support-agent` in [`ai/bedrock-builder.yaml`](../ai/bedrock-builder.yaml) |
| Bedrock Knowledge Base | `<org>-dev-genai-customer-support-agent-kb-test-customer-support`<br>`/<org>/genai/customer-support-agent/knowledge-base/kb-test-customer-support/name` | `knowledgeBases.kb-test-customer-support` in [`ai/bedrock-builder.yaml`](../ai/bedrock-builder.yaml) |
| OpenSearch Serverless Collection | `<org>-dev-genai-customer-support-agent-cs-vector-store`<br>`/<org>/genai/customer-support-agent/collection/cs-vector-store/name` | `vectorStores.cs-vector-store` in [`ai/bedrock-builder.yaml`](../ai/bedrock-builder.yaml) |
| S3 Bucket | `<org>-dev-shared-datalake-customer-support-docs`<br>`/<org>/shared/datalake/bucket/customer-support-docs/name` | `buckets.customer-support-docs` in [`datalake/datalake.yaml`](../datalake/datalake.yaml) |
| S3 Bucket | `<org>-dev-shared-datalake-product-docs`<br>`/<org>/shared/datalake/bucket/product-docs/name` | `buckets.product-docs` in [`datalake/datalake.yaml`](../datalake/datalake.yaml) |
| IAM Role | `<org>-dev-shared-roles-data-admin`<br>`/<org>/shared/generated-role/data-admin/id` | `generateRoles.data-admin` in [`roles.yaml`](../roles.yaml) |
| IAM Role | `<org>-dev-shared-roles-data-user`<br>`/<org>/shared/generated-role/data-user/id` | `generateRoles.data-user` in [`roles.yaml`](../roles.yaml) |

## Post-Deployment Steps

### Model Configuration

Choose your model ID from the [AWS Bedrock supported models list](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html).

- **Single region**: Use model ID directly (e.g., `anthropic.claude-3-5-sonnet-20240620-v1:0`)
- **Cross-region inference**: Use inference profile ARN (e.g., `arn:aws:bedrock:us-east-1:<account_id>:inference-profile/us.anthropic.claude-3-7-sonnet-20250219-v1:0`)
- **Knowledge base parsing**: Always use standard model ID format

#### Model Configuration Helper Script

```bash
#!/bin/bash
export LLM_MODEL_ID="anthropic.claude-3-7-sonnet-20250219-v1:0"
export AWS_REGION="us-east-1"

echo "Checking model: $LLM_MODEL_ID in region: $AWS_REGION"

MODEL_ARN=$(aws bedrock get-foundation-model --model-identifier "$LLM_MODEL_ID" --region "$AWS_REGION" --query "modelDetails.modelArn" --output text 2>/dev/null || echo "")

if [ -z "$MODEL_ARN" ]; then
    echo "Could not retrieve model ARN for $LLM_MODEL_ID"
    exit 1
fi

echo "Checking to see if there is a profile..."

PROFILE_ARN=$(aws bedrock list-inference-profiles --region "$AWS_REGION" --query "inferenceProfileSummaries[?contains(models[].modelArn, '$MODEL_ARN')].inferenceProfileArn" --output text 2>/dev/null || echo "")
if [ -n "$PROFILE_ARN" ]; then
    MODEL_TO_USE="$PROFILE_ARN"
    echo "Found inference profile in $AWS_REGION: $PROFILE_ARN"
else
    MODEL_TO_USE="$LLM_MODEL_ID"
    echo "No inference profile found, using model directly"
fi

echo "Testing accessibility of: $MODEL_TO_USE"

# Invoke the model with a minimal prompt to verify access
aws bedrock-runtime invoke-model \
    --model-id "$MODEL_TO_USE" \
    --region "$AWS_REGION" \
    --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}' \
    --content-type "application/json" \
    /dev/null 2>&1 && echo "Model is accessible." || echo "Model is NOT accessible. Check model access permissions in the Bedrock console."
```

### Testing the Agent

1. **Assume the `<org>-dev-shared-roles-data-admin` role** (this role has access to invoke Bedrock Agents).

2. **Navigate to Amazon Bedrock** > Agents > Select your deployed customer-support-agent.

3. **Use the Test Agent interface** to interact with the agent. Ask questions related to the documents you uploaded.

4. **Monitor agent performance** through CloudWatch logs and Bedrock trace.

### Document Upload

The customer support agent uses Amazon Bedrock Knowledge Bases for document ingestion and retrieval. Both data sources have `enableMultiSync: true` configured to handle concurrent file uploads and automatic syncing to the knowledge base.

#### Upload Locations

| Data Source | Bucket | Prefix |
|-------------|--------|--------|
| Support Documents (auto-sync) | `<org>-dev-shared-datalake-customer-support-docs` | `data/` |
| Product Documents (auto-sync) | `<org>-dev-shared-datalake-product-docs` | `data/` |

#### Upload Steps

1. **Set environment variables and assume the `<org>-dev-shared-roles-data-user` role**:

```bash
ORG="your-org-name"
ENV="dev"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws sts assume-role \
  --role-arn arn:aws:iam::${ACCOUNT_ID}:role/${ORG}-${ENV}-shared-roles-data-user \
  --role-session-name document-upload-session
```

2. **Upload documents** (KMS encryption required):

   Find the KMS key ARN via SSM: `/<org>/shared/datalake/kms/arn`

```bash
REGION="us-east-1"
KMS_KEY_ID="arn:aws:kms:${REGION}:${ACCOUNT_ID}:key/your-kms-key-id"

# Upload support documents
aws s3 cp your-support-doc.pdf \
  s3://${ORG}-${ENV}-shared-datalake-customer-support-docs/data/ \
  --sse aws:kms --sse-kms-key-id ${KMS_KEY_ID}

# Upload product documents
aws s3 cp your-product-doc.pdf \
  s3://${ORG}-${ENV}-shared-datalake-product-docs/data/ \
  --sse aws:kms --sse-kms-key-id ${KMS_KEY_ID}

# Bulk upload
aws s3 sync ./support-documents/ \
  s3://${ORG}-${ENV}-shared-datalake-customer-support-docs/data/ \
  --sse aws:kms --sse-kms-key-id ${KMS_KEY_ID}
```

3. **Sync the knowledge base** (if auto-sync hasn't triggered): Navigate to Amazon Bedrock > Knowledge Bases > Select the data source > Sync.

## Multi-Sync Architecture

This configuration implements a multi-sync architecture to handle AWS Knowledge Base service limitations (only one concurrent ingestion job per knowledge base).

| Constraint | Limit | Solution |
|------------|-------|----------|
| Concurrent ingestion jobs per knowledge base | 1 | Event batching and serialization |
| Concurrent ingestion jobs per data source | 1 | Sequential processing |
| Concurrent ingestion jobs per account | 5 | Account-level coordination |
| Maximum documents per API call | 25 | Batch size optimization |
| Maximum file size per ingestion | 50 MB | File validation |

Components:
- **SQS Queues**: Buffer S3 events for batch processing
- **Batch Sync Lambda**: Processes events in serialized batches
- **Dead Letter Queues**: Handle failed processing attempts

