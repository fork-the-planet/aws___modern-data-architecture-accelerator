/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaRdsServerlessClusterProps } from './serverless-cluster';
import { MdaaResourceType } from '@aws-mdaa/naming';

const CLUSTER_IDENTIFIER_LENGTH = 63;
const CLUSTER_IDENTIFIER_REGEX = /^[a-zA-Z](?:-?[a-zA-Z0-9]){0,62}$/;

export function getSanitizeClusterIdentifier(props: MdaaRdsServerlessClusterProps): string {
  const rdsNaming = props.naming.withResourceType(MdaaResourceType.RDS_CLUSTER);
  const nameOfRightLength = rdsNaming.resourceName(props.clusterIdentifier, CLUSTER_IDENTIFIER_LENGTH);
  const sanitizedName = nameOfRightLength.replace(/-+/g, '-');

  if (!CLUSTER_IDENTIFIER_REGEX.test(sanitizedName)) {
    throw new Error(`Unable to sanitize cluster identifier: ${props.clusterIdentifier}`);
  }

  return sanitizedName;
}
