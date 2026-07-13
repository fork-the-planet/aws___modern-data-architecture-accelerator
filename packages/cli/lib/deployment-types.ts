/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// NOTE (not part of the config docs): this type lives in its own dependency-free
// module so that low-level consumers (such as the deployment-target validator) can
// reference it without importing the higher-level config parser, avoiding a
// circular module dependency. Keep the JSDoc below limited to user-facing content,
// since it is surfaced verbatim in the generated config schema / SCHEMA.md.

/**
 * A single deployment target (account/region) for an MDAA module. Used both for
 * the primary deployment and for entries under `additional_stacks` /
 * `additional_accounts`.
 */
export interface Deployment {
  /** The target region. If not specified, defaults to the CDK default region. */
  readonly region?: string;
  /** The target account. If not specified, defaults to the CDK default account. */
  readonly account?: string;
  /** If true, adds a dependency on the main stack to make sure the main stack is deployed first. If not specified, defaults to true.*/
  readonly addDependencyMainStack?: boolean;
}
