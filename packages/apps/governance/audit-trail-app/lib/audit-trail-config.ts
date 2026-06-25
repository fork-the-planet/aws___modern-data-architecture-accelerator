/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaAppConfigParser, MdaaAppConfigParserProps, MdaaBaseConfigContents } from '@aws-mdaa/app';
import { AuditTrailProps } from '@aws-mdaa/audit-trail-l3-construct';
import { Schema } from 'ajv';
import { Stack } from 'aws-cdk-lib';
import * as configSchema from './config-schema.json';

export interface AuditTrailConfigContents extends MdaaBaseConfigContents {
  /**
   * Deprecated. Use 'trails' with a key of 's3-audit' for equivalent behavior.
   * CloudTrail audit trail configuration defining S3 destination, KMS encryption,
   * and event scope for compliance monitoring.
   *
   * Use cases: S3 data event auditing; Compliance logging; Security monitoring
   *
   * AWS: CloudTrail trail with S3 data events and KMS encryption
   *
   * Validation: Optional; must be valid AuditTrailProps
   * @deprecated Use `trails` with a key of `'s3-audit'` for equivalent behavior.
   */
  readonly trail?: AuditTrailProps;
  /**
   * Named CloudTrail audit trail configurations for deploying multiple independent trails.
   * Each key is used as the trail's resource name segment.
   *
   * Use cases: Multiple trails per domain; Separate trails for different compliance scopes
   *
   * AWS: Multiple CloudTrail trails with independent configuration
   *
   * Validation: Optional; keys must be valid resource name segments; values must be valid AuditTrailProps
   */
  readonly trails?: { readonly [name: string]: AuditTrailProps };
}

export class AuditTrailConfigParser extends MdaaAppConfigParser<AuditTrailConfigContents> {
  public readonly trail?: AuditTrailProps;
  public readonly trails?: { readonly [name: string]: AuditTrailProps };

  constructor(stack: Stack, props: MdaaAppConfigParserProps) {
    super(stack, props, configSchema as Schema);
    this.trail = this.configContents.trail; //NOSONAR — backward-compat wiring for deprecated property
    this.trails = this.configContents.trails;
  }
}
