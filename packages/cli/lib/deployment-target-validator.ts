/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Deployment } from './deployment-types';

/**
 * Validation of AWS deployment-target values (region, account) prior to their
 * interpolation into shell command strings executed by the CLI.
 *
 * region and account values originate from user-supplied YAML configuration and
 * are interpolated into `export CDK_DEPLOY_*` / `AWS_DEFAULT_REGION` statements
 * (and Terraform `-var region=`) that run in a shell via child_process. Without
 * validation, a value such as `us-east-1$(malicious-command)` would be executed
 * as an OS command on the machine running the CLI. These allowlist checks reject
 * any value containing shell metacharacters, closing that injection vector.
 *
 * Two flavours are provided:
 *  - `validateDeployRegionResolved` / `validateDeployAccountResolved` — strict
 *    checks for a *resolved* value that is about to be interpolated into a shell
 *    command. Use these at the interpolation sites and after reference
 *    resolution.
 *  - `validateDeployRegionValueOrRef` / `validateDeployAccountValueOrRef` —
 *    lenient checks for a value that may still be an unresolved reference (as
 *    seen at config-parse time). Concrete values are validated immediately;
 *    references and the `default` sentinel are passed through to be re-validated
 *    once resolved.
 */

// AWS region codes are lowercase alphanumeric segments separated by hyphens
// (e.g. us-east-1, eu-west-2, us-gov-west-1, cn-north-1). This also admits the
// sentinel value 'default', which callers exclude before interpolation anyway.
const REGION_PATTERN = /^[a-z0-9-]+$/;

// AWS account IDs are exactly 12 digits.
const ACCOUNT_PATTERN = /^\d{12}$/;

const DEFAULT_SENTINEL = 'default';

/**
 * Validate a resolved region value that is about to be interpolated into a shell
 * command. Returns the value unchanged when valid so it can be used inline.
 *
 * @throws Error if the value contains anything other than lowercase letters,
 *   digits, and hyphens.
 */
export function validateDeployRegionResolved(region: string, context: string): string {
  if (!REGION_PATTERN.test(region)) {
    throw new Error(
      `Invalid region '${region}' (${context}). ` +
        `Region must match ${REGION_PATTERN} (e.g. 'us-east-1'). ` +
        `This value is interpolated into a shell command and must not contain special characters.`,
    );
  }
  return region;
}

/**
 * Validate a resolved account value that is about to be interpolated into a shell
 * command. Returns the value unchanged when valid so it can be used inline.
 *
 * @throws Error if the value is not a 12-digit AWS account ID.
 */
export function validateDeployAccountResolved(account: string, context: string): string {
  if (!ACCOUNT_PATTERN.test(account)) {
    throw new Error(
      `Invalid account '${account}' (${context}). ` +
        `Account must be a 12-digit AWS account ID. ` +
        `This value is interpolated into a shell command and must not contain special characters.`,
    );
  }
  return account;
}

/**
 * A dynamic config reference such as `{{context:team_account}}` or
 * `{{env_var:PROD_REGION}}` only takes its final value once the config
 * transformer runs (per-module, after parsing). Detecting the `{{` / `}}`
 * delimiters — the same ones the transformer matches on — lets parse-time
 * validation defer these values to the post-resolution checks instead of
 * rejecting a legitimate reference.
 *
 * This is intentionally an over-approximation: a genuine region/account can
 * never contain `{{`, so anything matching here is either a real reference or
 * a malformed value that the resolved-value validators will still reject
 * (e.g. a mixed `{{ref}}$(cmd)` payload is deferred here but caught once
 * resolved). Deferring is therefore always safe.
 */
export function isConfigReference(value: string): boolean {
  return value.includes('{{') && value.includes('}}');
}

/**
 * Validate a region value that may still be a dynamic reference (as seen at
 * config-parse time). References and the `default` sentinel are passed through
 * unchanged — references because they resolve later (and are re-validated at
 * that point via {@link validateDeployRegionResolved}), `default` because it is
 * a recognized sentinel. Concrete values are validated immediately so malformed
 * literals fail fast.
 */
export function validateDeployRegionValueOrRef(region: string, context: string): string {
  if (isConfigReference(region) || region.toLowerCase() === DEFAULT_SENTINEL) {
    return region;
  }
  return validateDeployRegionResolved(region, context);
}

/**
 * Validate an account value that may still be a dynamic reference (as seen at
 * config-parse time). Mirrors {@link validateDeployRegionValueOrRef}: references
 * and the `default` sentinel pass through, concrete values are validated
 * immediately.
 */
export function validateDeployAccountValueOrRef(account: string, context: string): string {
  if (isConfigReference(account) || account.toLowerCase() === DEFAULT_SENTINEL) {
    return account;
  }
  return validateDeployAccountResolved(account, context);
}

/**
 * Validate the region/account of each additional deployment (from
 * `additional_stacks` / `additional_accounts`) before the collection is
 * serialized into the CDK context command. Values are resolved by this point,
 * so the strict resolved-value checks apply. The `default` sentinel is skipped,
 * matching the guards applied to the primary deployment target.
 */
export function validateDeployments(deployments: Deployment[]): void {
  deployments.forEach((deployment, index) => {
    if (deployment.account !== undefined && deployment.account.toLowerCase() !== DEFAULT_SENTINEL) {
      validateDeployAccountResolved(deployment.account, `additional_stacks[${index}].account`);
    }
    if (deployment.region !== undefined && deployment.region.toLowerCase() !== DEFAULT_SENTINEL) {
      validateDeployRegionResolved(deployment.region, `additional_stacks[${index}].region`);
    }
  });
}
