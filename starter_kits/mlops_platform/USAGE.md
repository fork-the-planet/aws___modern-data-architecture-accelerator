# Usage

## Deployed Resources

Once deployed, you should see the following in your AWS account:

**Naming convention:** `<org>-<env>-<domain>-<module>-<resource>`

**SSM parameters:** `/<org>/<domain>/<module>/<resource-type>/<resource-name>/<attribute>`

| Resource | Deployed Name / SSM Path | Config Reference |
|----------|--------------------------|------------------|
| CodePipeline Pipeline (Training) | `<org>-dev-mlops-core-<project>-build`<br>`/<org>/mlops/core/pipeline/training/name` | `training` in [`mlops/mlops.yaml`](mlops/mlops.yaml) |
| CodePipeline Pipeline (Deploy) | `<org>-dev-mlops-core-<project>-deploy`<br>`/<org>/mlops/core/pipeline/deploy/name` | `deploy` in [`mlops/mlops.yaml`](mlops/mlops.yaml) |
| SageMaker Model Package Group | `<org>-dev-mlops-core-<project>-mpg`<br>`/<org>/mlops/core/model-package-group/name` | deployed by [`mlops/mlops.yaml`](mlops/mlops.yaml)<br>*(not configurable)* |
| S3 Bucket (Artifacts) | `<org>-dev-mlops-core-model-<project>`<br>`/<org>/mlops/core/bucket/name` | deployed by [`mlops/mlops.yaml`](mlops/mlops.yaml)<br>*(not configurable)* |
| CodeCommit Repository (Training) | `<org>-dev-mlops-core-<project>-build`<br>`/<org>/mlops/core/repository/training/name` | `training.seedCodePath` in [`mlops/mlops.yaml`](mlops/mlops.yaml) |
| CodeCommit Repository (Deploy) | `<org>-dev-mlops-core-<project>-deploy`<br>`/<org>/mlops/core/repository/deploy/name` | `deploy.seedCodePath` in [`mlops/mlops.yaml`](mlops/mlops.yaml) |

## Post-Deployment Steps

### 1. Verify Pipeline Execution

The training pipeline starts automatically after deployment:

1. Navigate to **AWS CodePipeline Console** > select `<org>-dev-mlops-core-<project>-build`.
2. Confirm the pipeline execution is in progress or has completed successfully.
3. If the Source stage fails, verify the CodeCommit repository contains the seed code.

### 2. Approve the Trained Model

Once training completes, the model is registered in SageMaker Model Registry in "PendingManualApproval" status:

1. Navigate to **SageMaker Console** > **Model Registry** > select `<org>-dev-mlops-core-<project>-mpg`.
2. Select the latest model version.
3. Change the status to **Approved** to trigger the deploy pipeline.

### 3. Verify Endpoint Deployment

After approval, EventBridge triggers the deploy pipeline automatically:

1. Navigate to **CodePipeline Console** > select `<org>-dev-mlops-core-<project>-deploy`.
2. Confirm the pipeline completes successfully.
3. Navigate to **SageMaker Console** > **Inference** > **Endpoints** to confirm the endpoint is "InService".

### Updating Seed Code

CloudFormation does not update existing CodeCommit repositories on subsequent deployments. To update training or deployment code:

```bash
# Clone the training repo
git clone codecommit://<org>-dev-mlops-core-<project>-build

# Make changes, commit, and push to trigger a new pipeline execution
git push
```
