/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaAppConfigParserProps, MdaaCdkApp } from '@aws-mdaa/app';
import { DataopsAuroraL3Construct, DataopsAuroraL3ConstructProps } from '@aws-mdaa/dataops-aurora-l3-construct';
import { MdaaL3ConstructProps } from '@aws-mdaa/l3-construct';
import { AppProps, Stack } from 'aws-cdk-lib';
import { DataopsAuroraConfigParser } from './dataops-aurora-config';

export class DataopsAuroraApp extends MdaaCdkApp {
  constructor(props: AppProps = {}) {
    super(props, MdaaCdkApp.parsePackageJson(`${__dirname}/../package.json`));
  }

  protected subGenerateResources(
    stack: Stack,
    l3ConstructProps: MdaaL3ConstructProps,
    parserProps: MdaaAppConfigParserProps,
  ) {
    const appConfig = new DataopsAuroraConfigParser(stack, parserProps);

    const constructProps: DataopsAuroraL3ConstructProps = {
      ...l3ConstructProps,
      postgresqlClusters: appConfig.postgresqlClusters,
      projectName: appConfig.projectName,
      kmsArn: appConfig.kmsArn,
      dataAdminRoles: appConfig.dataAdminRoles,
    };

    new DataopsAuroraL3Construct(stack, 'construct', constructProps);

    return [stack];
  }
}
