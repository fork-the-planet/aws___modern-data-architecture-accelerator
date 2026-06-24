/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaRoleHelper } from '@aws-mdaa/iam-role-helper';
import { MdaaResourceType } from '@aws-mdaa/naming';
import { MdaaTestApp } from '@aws-mdaa/testing';
import {
  SharedFoldersPermissionsProps,
  SharedFoldersProps,
  DataSourcePermissionsProps,
  DataSourceWithIdAndTypeProps,
  QuickSightProjectL3ConstructProps,
  QuickSightProjectL3Construct,
} from '../lib';
import { Match, Template } from 'aws-cdk-lib/assertions';

describe('MDAA Compliance Stack Tests', () => {
  const testApp = new MdaaTestApp();
  //Shared Folders Related Objects
  const testFolderReaderPermissions: SharedFoldersPermissionsProps = {
    principal: 'READERS_GROUP',
    actions: 'READER_FOLDER',
  };
  const testFolderAuthorPermissions: SharedFoldersPermissionsProps = {
    principal: 'AUTHORS_GROUP',
    actions: 'AUTHOR_FOLDER',
  };
  const testReaderSharedFolders: SharedFoldersProps = {
    permissions: [testFolderReaderPermissions],
    folders: {
      testSubFolder1: {
        permissions: [testFolderReaderPermissions],
      },
      testSubFolder2: {
        permissions: [testFolderReaderPermissions],
      },
    },
  };
  const testAuthorSharedFolders: SharedFoldersProps = {
    permissions: [testFolderAuthorPermissions],
    folders: {
      testSubFolder1: {
        permissions: [testFolderReaderPermissions],
      },
      testSubFolder2: {
        permissions: [testFolderReaderPermissions],
      },
    },
  };
  //DataSource Related Objects
  const testDataSourceReaderPermissions: DataSourcePermissionsProps = {
    principal: 'READERS_GROUP',
    actions: 'READER_DATA_SOURCE',
  };
  const testDataSourceAuthorPermissions: DataSourcePermissionsProps = {
    principal: 'AUTHORS_GROUP',
    actions: 'AUTHOR_DATA_SOURCE',
  };
  const testAthenaDataSource: DataSourceWithIdAndTypeProps = {
    dataSourceId: 'sampleAthena',
    awsAccountId: 'test-account',
    dataSourceSpecificParameters: { athenaParameters: { workGroup: 'primary' } },
    displayName: 'sampleAthena',
    permissions: [testDataSourceReaderPermissions],
    sslProperties: { disableSsl: false },
    type: 'ATHENA',
  };
  const testRedshiftDataSource: DataSourceWithIdAndTypeProps = {
    awsAccountId: 'test-account',
    dataSourceId: 'sampleRedshift',
    dataSourceSpecificParameters: { redshiftParameters: { database: 'test', clusterId: 'testCluster' } },
    displayName: 'sampleRedshift',
    permissions: [testDataSourceAuthorPermissions],
    sslProperties: { disableSsl: false },
    type: 'REDSHIFT',
    //credentials: {"secretArn": "arn:test-partition:secretsmanager:test-region:accountID:secret:secretname"},
    credentials: {
      credentialPair: {
        password: '{{resolve:secretsmanager:/test/redshift/admin/user:SecretString:password}}',
        username: '{{resolve:secretsmanager:/test/redshift/admin/user:SecretString:username}}',
      },
    },
    vpcConnectionProperties: {
      vpcConnectionArn: 'arn:test-partition:quicksight:test-region:test-account:vpcConnection/test',
    },
  };
  const constructProps: QuickSightProjectL3ConstructProps = {
    principals: {
      ALL_USERS_GROUP: 'arn:test-partition:quicksight:test-region:test-account:group/testNamespace/testAllUsersQSGroup',
      READERS_GROUP: 'arn:test-partition:quicksight:test-region:test-account:group/testNamespace/testReaderOnlyQSGroup',
      AUTHORS_GROUP: 'arn:test-partition:quicksight:test-region:test-account:group/testNamespace/testAuthorOnlyQSGroup',
    },
    sharedFolders: { testReadFolder: testReaderSharedFolders, testAuthorFolder: testAuthorSharedFolders },
    dataSources: [testAthenaDataSource, testRedshiftDataSource],
    naming: testApp.naming,

    roleHelper: new MdaaRoleHelper(testApp.testStack, testApp.naming),
  };

  new QuickSightProjectL3Construct(testApp.testStack, 'test-stack', constructProps);
  testApp.checkCdkNagCompliance(testApp.testStack);
  const template = Template.fromStack(testApp.testStack);
  test('Validate if the 2 Lambda functions[CR and QSFolder] are created', () => {
    template.resourceCountIs('AWS::Lambda::Function', 2);
  });

  test('qsFolders ManagedPolicy uses IAM_POLICY resource type', () => {
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      ManagedPolicyName: testApp.naming
        .withResourceType(MdaaResourceType.IAM_POLICY)
        .resourceName('qsFolders-cr-lambda'),
    });
  });

  test('qsFolders CR provider Lambda function uses LAMBDA_FUNCTION resource type', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: testApp.naming
        .withResourceType(MdaaResourceType.LAMBDA_FUNCTION)
        .resourceName('qsFolders-cr-prov', 64),
    });
  });
  // Verify QS Permissions provided to qsFolders-cr-func Lambda Function
  test('QS Permissions to Lambda Function', () => {
    template.hasResourceProperties(
      'AWS::IAM::ManagedPolicy',
      Match.objectLike({
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'quicksight:CreateFolder',
                'quicksight:DeleteFolder',
                'quicksight:DescribeFolder',
                'quicksight:DescribeFolderPermissions',
                'quicksight:DescribeFolderResolvedPermissions',
                'quicksight:ListFolderMembers',
                'quicksight:ListFolders',
                'quicksight:UpdateFolder',
                'quicksight:UpdateFolderPermissions',
              ],
              Effect: 'Allow',
              Resource: 'arn:test-partition:quicksight:test-region:test-account:folder/*',
            },
            {
              Action: ['quicksight:CreateFolderMembership', 'quicksight:DeleteFolderMembership'],
              Effect: 'Allow',
              Resource: 'arn:test-partition:quicksight:test-region:test-account:folder/*',
            },
          ],
        },
      }),
    );
  });
  // READER: Verify Properties for QS Folders like folderpermissions, folderName, etc.
  test('QS Folder Creation with READER Permissions', () => {
    template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
      folderDetails: Match.objectLike({
        folderName: 'testReadFolder',
        folderPermissions: [
          {
            Principal:
              'arn:test-partition:quicksight:test-region:test-account:group/testNamespace/testReaderOnlyQSGroup',
            Actions: ['quicksight:DescribeFolder'],
          },
        ],
        folderNameWithParentName: 'testReadFolder',
      }),
    });
  });
  // AUTHOR: Verify Properties for QS Folders like folderpermissions, folderName, etc.
  test('QS Folder Creation with AUTHOR Permissions', () => {
    template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
      folderDetails: Match.objectLike({
        folderName: 'testAuthorFolder',
        folderPermissions: [
          {
            Principal:
              'arn:test-partition:quicksight:test-region:test-account:group/testNamespace/testAuthorOnlyQSGroup',
            Actions: [
              'quicksight:CreateFolder',
              'quicksight:DescribeFolder',
              'quicksight:UpdateFolder',
              'quicksight:DeleteFolder',
              'quicksight:CreateFolder',
              'quicksight:CreateFolderMembership',
              'quicksight:DeleteFolderMembership',
              'quicksight:DescribeFolderPermissions',
              'quicksight:UpdateFolderPermissions',
            ],
          },
        ],
        folderNameWithParentName: 'testAuthorFolder',
      }),
    });
  });
  // Test Athena Data Sources
  test('QS Athena DataSource', () => {
    template.hasResourceProperties('AWS::QuickSight::DataSource', {
      AlternateDataSourceParameters: [
        {
          AthenaParameters: {
            WorkGroup: 'primary',
            RoleArn: 'arn:test-partition:iam::test-account:role/service-role/aws-quicksight-service-role-v0',
          },
        },
      ],
      AwsAccountId: 'test-account',
      DataSourceId: 'test-org-test-env-test-domain-test-module-sampleathena',
      DataSourceParameters: {
        AthenaParameters: {
          WorkGroup: 'primary',
          RoleArn: 'arn:test-partition:iam::test-account:role/service-role/aws-quicksight-service-role-v0',
        },
      },
      Name: 'test-org-test-env-test-domain-test-module-sampleathena',
      Permissions: [
        {
          Actions: [
            'quicksight:DescribeDataSource',
            'quicksight:DescribeDataSourcePermissions',
            'quicksight:PassDataSource',
          ],
          Principal: 'arn:test-partition:quicksight:test-region:test-account:group/testNamespace/testReaderOnlyQSGroup',
        },
      ],
      SslProperties: {
        DisableSsl: false,
      },
      Type: 'ATHENA',
    });
  });
  // Test Redshift Data Sources
  test('QS Redshift DataSource', () => {
    template.hasResourceProperties('AWS::QuickSight::DataSource', {
      AlternateDataSourceParameters: [
        {
          RedshiftParameters: {
            ClusterId: 'testCluster',
            Database: 'test',
          },
        },
      ],
      AwsAccountId: 'test-account',
      Credentials: {
        CredentialPair: {
          Password: '{{resolve:secretsmanager:/test/redshift/admin/user:SecretString:password}}',
          Username: '{{resolve:secretsmanager:/test/redshift/admin/user:SecretString:username}}',
        },
      },
      DataSourceId: 'test-org-test-env-test-domain-test-module-sampleredshift',
      DataSourceParameters: {
        RedshiftParameters: {
          ClusterId: 'testCluster',
          Database: 'test',
        },
      },
      Name: 'test-org-test-env-test-domain-test-module-sampleredshift',
      Permissions: [
        {
          Actions: [
            'quicksight:DescribeDataSource',
            'quicksight:DescribeDataSourcePermissions',
            'quicksight:PassDataSource',
            'quicksight:UpdateDataSource',
            'quicksight:DeleteDataSource',
            'quicksight:UpdateDataSourcePermissions',
          ],
          Principal: 'arn:test-partition:quicksight:test-region:test-account:group/testNamespace/testAuthorOnlyQSGroup',
        },
      ],
      SslProperties: {
        DisableSsl: false,
      },
      Type: 'REDSHIFT',
      VpcConnectionProperties: {
        VpcConnectionArn: 'arn:test-partition:quicksight:test-region:test-account:vpcConnection/test',
      },
    });
  });
});

describe('Redshift IAM Auth Role Tests', () => {
  const testApp = new MdaaTestApp();
  const constructProps: QuickSightProjectL3ConstructProps = {
    principals: {
      READERS_GROUP: 'arn:test-partition:quicksight:test-region:test-account:group/testNamespace/testReaderOnlyQSGroup',
    },
    dataSources: [
      {
        dataSourceId: 'sampleRedshift',
        awsAccountId: 'test-account',
        dataSourceSpecificParameters: {
          redshiftParameters: {
            database: 'default_db',
            clusterId: 'test-cluster',
            port: 5440,
            iamParameters: {
              autoCreateDatabaseUser: true,
              databaseUser: 'quicksight',
            },
          },
        },
        displayName: 'sampleRedshift',
        permissions: [{ principal: 'READERS_GROUP', actions: 'READER_DATA_SOURCE' }],
        type: 'REDSHIFT',
        vpcConnectionProperties: {
          vpcConnectionArn: 'arn:test-partition:quicksight:test-region:test-account:vpcConnection/test',
        },
      },
    ],
    naming: testApp.naming,
    roleHelper: new MdaaRoleHelper(testApp.testStack, testApp.naming),
  };

  new QuickSightProjectL3Construct(testApp.testStack, 'test-stack', constructProps);
  testApp.checkCdkNagCompliance(testApp.testStack);
  const template = Template.fromStack(testApp.testStack);

  test('Creates a QuickSight-assumable role with GetClusterCredentials scoped to the cluster', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'quicksight.amazonaws.com' },
          }),
        ]),
      },
    });
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'RedshiftGetClusterCredentials',
            Action: Match.arrayWith(['redshift:GetClusterCredentials']),
            Resource: Match.arrayWith([
              'arn:test-partition:redshift:test-region:test-account:dbuser:test-cluster/quicksight',
            ]),
          }),
        ]),
      },
    });
  });

  test('Injects the created role ARN into the Redshift data source iamParameters', () => {
    template.hasResourceProperties('AWS::QuickSight::DataSource', {
      DataSourceParameters: {
        RedshiftParameters: Match.objectLike({
          IAMParameters: Match.objectLike({
            RoleArn: Match.objectLike({ 'Fn::GetAtt': Match.anyValue() }),
          }),
        }),
      },
    });
  });
});

describe('Redshift Secrets Manager Auth Tests', () => {
  const testApp = new MdaaTestApp();
  const constructProps: QuickSightProjectL3ConstructProps = {
    principals: {
      READERS_GROUP: 'arn:test-partition:quicksight:test-region:test-account:group/testNamespace/testReaderOnlyQSGroup',
    },
    dataSources: [
      {
        dataSourceId: 'sampleRedshift',
        awsAccountId: 'test-account',
        dataSourceSpecificParameters: {
          redshiftParameters: {
            database: 'default_db',
            clusterId: 'test-cluster',
            port: 5440,
          },
        },
        displayName: 'sampleRedshift',
        permissions: [{ principal: 'READERS_GROUP', actions: 'READER_DATA_SOURCE' }],
        type: 'REDSHIFT',
        secretsManager: {
          arn: 'arn:test-partition:secretsmanager:test-region:test-account:secret:test-secret',
          kmsKeyArns: ['arn:test-partition:kms:test-region:test-account:key/test-key-id'],
        },
        vpcConnectionProperties: {
          vpcConnectionArn: 'arn:test-partition:quicksight:test-region:test-account:vpcConnection/test',
        },
      },
    ],
    naming: testApp.naming,
    roleHelper: new MdaaRoleHelper(testApp.testStack, testApp.naming),
  };

  new QuickSightProjectL3Construct(testApp.testStack, 'test-stack', constructProps);
  testApp.checkCdkNagCompliance(testApp.testStack);
  const template = Template.fromStack(testApp.testStack);

  test('Wires the secret ARN as the data source credentials', () => {
    template.hasResourceProperties('AWS::QuickSight::DataSource', {
      Credentials: Match.objectLike({
        SecretArn: 'arn:test-partition:secretsmanager:test-region:test-account:secret:test-secret',
      }),
    });
  });

  test('Grants the QuickSight Secrets Manager role read access to the secret and its KMS key', () => {
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      Roles: ['aws-quicksight-secretsmanager-role-v0'],
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'SecretsManagerAccess',
            Action: Match.arrayWith(['secretsmanager:GetSecretValue']),
            Resource: 'arn:test-partition:secretsmanager:test-region:test-account:secret:test-secret',
          }),
          Match.objectLike({
            Sid: 'SecretKmsDecrypt',
            Action: Match.arrayWith(['kms:Decrypt']),
            Resource: 'arn:test-partition:kms:test-region:test-account:key/test-key-id',
          }),
        ]),
      },
    });
  });
});

describe('Redshift IAM Auth Validation Tests', () => {
  test('Throws when iamParameters is configured but clusterId is missing', () => {
    const testApp = new MdaaTestApp();
    const constructProps: QuickSightProjectL3ConstructProps = {
      principals: {
        READERS_GROUP:
          'arn:test-partition:quicksight:test-region:test-account:group/testNamespace/testReaderOnlyQSGroup',
      },
      dataSources: [
        {
          dataSourceId: 'sampleRedshift',
          awsAccountId: 'test-account',
          dataSourceSpecificParameters: {
            redshiftParameters: {
              database: 'default_db',
              // clusterId intentionally omitted
              port: 5440,
              iamParameters: {
                autoCreateDatabaseUser: true,
                databaseUser: 'quicksight',
              },
            },
          },
          displayName: 'sampleRedshift',
          permissions: [{ principal: 'READERS_GROUP', actions: 'READER_DATA_SOURCE' }],
          type: 'REDSHIFT',
          vpcConnectionProperties: {
            vpcConnectionArn: 'arn:test-partition:quicksight:test-region:test-account:vpcConnection/test',
          },
        },
      ],
      naming: testApp.naming,
      roleHelper: new MdaaRoleHelper(testApp.testStack, testApp.naming),
    };

    expect(() => new QuickSightProjectL3Construct(testApp.testStack, 'test-stack', constructProps)).toThrow(
      /missing redshiftParameters.clusterId/,
    );
  });

  test('Wildcards the dbuser resource when databaseUser is omitted (auto-create case)', () => {
    const testApp = new MdaaTestApp();
    const constructProps: QuickSightProjectL3ConstructProps = {
      principals: {
        READERS_GROUP:
          'arn:test-partition:quicksight:test-region:test-account:group/testNamespace/testReaderOnlyQSGroup',
      },
      dataSources: [
        {
          dataSourceId: 'sampleRedshift',
          awsAccountId: 'test-account',
          dataSourceSpecificParameters: {
            redshiftParameters: {
              database: 'default_db',
              clusterId: 'test-cluster',
              port: 5440,
              iamParameters: {
                autoCreateDatabaseUser: true,
                // databaseUser intentionally omitted — QuickSight auto-creates the user at runtime
              },
            },
          },
          displayName: 'sampleRedshift',
          permissions: [{ principal: 'READERS_GROUP', actions: 'READER_DATA_SOURCE' }],
          type: 'REDSHIFT',
          vpcConnectionProperties: {
            vpcConnectionArn: 'arn:test-partition:quicksight:test-region:test-account:vpcConnection/test',
          },
        },
      ],
      naming: testApp.naming,
      roleHelper: new MdaaRoleHelper(testApp.testStack, testApp.naming),
    };

    const template = Template.fromStack(
      (() => {
        new QuickSightProjectL3Construct(testApp.testStack, 'test-stack', constructProps);
        return testApp.testStack;
      })(),
    );
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'RedshiftGetClusterCredentials',
            Resource: Match.arrayWith(['arn:test-partition:redshift:test-region:test-account:dbuser:test-cluster/*']),
          }),
        ]),
      },
    });
  });
});

describe('Athena Role Default Tests', () => {
  const testApp = new MdaaTestApp();
  const constructProps: QuickSightProjectL3ConstructProps = {
    principals: {
      READERS_GROUP: 'arn:test-partition:quicksight:test-region:test-account:group/testNamespace/testReaderOnlyQSGroup',
    },
    dataSources: [
      {
        dataSourceId: 'defaultRole',
        awsAccountId: 'test-account',
        dataSourceSpecificParameters: { athenaParameters: { workGroup: 'primary' } },
        displayName: 'defaultRole',
        permissions: [{ principal: 'READERS_GROUP', actions: 'READER_DATA_SOURCE' }],
        type: 'ATHENA',
      },
      {
        dataSourceId: 'overrideRole',
        awsAccountId: 'test-account',
        dataSourceSpecificParameters: {
          athenaParameters: { workGroup: 'primary', roleArn: 'arn:test-partition:iam::test-account:role/custom-role' },
        },
        displayName: 'overrideRole',
        permissions: [{ principal: 'READERS_GROUP', actions: 'READER_DATA_SOURCE' }],
        type: 'ATHENA',
      },
    ],
    naming: testApp.naming,
    roleHelper: new MdaaRoleHelper(testApp.testStack, testApp.naming),
  };

  new QuickSightProjectL3Construct(testApp.testStack, 'test-stack', constructProps);
  testApp.checkCdkNagCompliance(testApp.testStack);
  const template = Template.fromStack(testApp.testStack);

  test('Defaults Athena roleArn to the QuickSight resource-access role when not specified', () => {
    template.hasResourceProperties('AWS::QuickSight::DataSource', {
      DataSourceId: 'test-org-test-env-test-domain-test-module-defaultrole',
      DataSourceParameters: {
        AthenaParameters: Match.objectLike({
          RoleArn: 'arn:test-partition:iam::test-account:role/service-role/aws-quicksight-service-role-v0',
        }),
      },
    });
  });

  test('Preserves an explicitly configured Athena roleArn (override wins)', () => {
    template.hasResourceProperties('AWS::QuickSight::DataSource', {
      DataSourceId: 'test-org-test-env-test-domain-test-module-overriderole',
      DataSourceParameters: {
        AthenaParameters: Match.objectLike({
          RoleArn: 'arn:test-partition:iam::test-account:role/custom-role',
        }),
      },
    });
  });
});

describe('Resource Access Role Permissions Tests', () => {
  const testApp = new MdaaTestApp();
  const constructProps: QuickSightProjectL3ConstructProps = {
    principals: {
      READERS_GROUP: 'arn:test-partition:quicksight:test-region:test-account:group/testNamespace/testReaderOnlyQSGroup',
    },
    resourceAccessRolePermissions: {
      s3BucketArns: ['arn:test-partition:s3:::test-data-bucket', 'arn:test-partition:s3:::test-athena-results'],
      kmsKeyArns: ['arn:test-partition:kms:test-region:test-account:key/test-key-id'],
    },
    naming: testApp.naming,
    roleHelper: new MdaaRoleHelper(testApp.testStack, testApp.naming),
  };

  new QuickSightProjectL3Construct(testApp.testStack, 'test-stack', constructProps);
  testApp.checkCdkNagCompliance(testApp.testStack);
  const template = Template.fromStack(testApp.testStack);

  test('Creates a managed policy scoping S3 object and KMS access to the configured ARNs', () => {
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      ManagedPolicyName: testApp.naming
        .withResourceType(MdaaResourceType.IAM_POLICY)
        .resourceName('qs-resource-access'),
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'S3ObjectAccess',
            Action: Match.arrayWith(['s3:GetObject', 's3:PutObject']),
            Resource: ['arn:test-partition:s3:::test-data-bucket/*', 'arn:test-partition:s3:::test-athena-results/*'],
          }),
          Match.objectLike({
            Sid: 'KmsDataAccess',
            Action: Match.arrayWith(['kms:Decrypt']),
            Resource: 'arn:test-partition:kms:test-region:test-account:key/test-key-id',
          }),
        ]),
      },
    });
  });

  test('Scopes the S3ListAllBuckets statement to the wildcard bucket ARN', () => {
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      ManagedPolicyName: testApp.naming
        .withResourceType(MdaaResourceType.IAM_POLICY)
        .resourceName('qs-resource-access'),
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'S3ListAllBuckets',
            Action: 's3:ListAllMyBuckets',
            Resource: 'arn:test-partition:s3:::*',
          }),
        ]),
      },
    });
  });

  test('Scopes the S3BucketAccess statement actions to the configured bucket ARNs', () => {
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      ManagedPolicyName: testApp.naming
        .withResourceType(MdaaResourceType.IAM_POLICY)
        .resourceName('qs-resource-access'),
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'S3BucketAccess',
            Action: ['s3:ListBucket', 's3:GetBucketLocation', 's3:ListBucketMultipartUploads'],
            Resource: ['arn:test-partition:s3:::test-data-bucket', 'arn:test-partition:s3:::test-athena-results'],
          }),
        ]),
      },
    });
  });

  test('Attaches the data-access managed policy to the imported resource-access role by name', () => {
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      ManagedPolicyName: testApp.naming
        .withResourceType(MdaaResourceType.IAM_POLICY)
        .resourceName('qs-resource-access'),
      Roles: ['aws-quicksight-service-role-v0'],
    });
  });
});

describe('Resource Access Role Permissions KMS-Only Tests', () => {
  const testApp = new MdaaTestApp();
  const constructProps: QuickSightProjectL3ConstructProps = {
    principals: {
      READERS_GROUP: 'arn:test-partition:quicksight:test-region:test-account:group/testNamespace/testReaderOnlyQSGroup',
    },
    resourceAccessRolePermissions: {
      kmsKeyArns: ['arn:test-partition:kms:test-region:test-account:key/test-key-id'],
    },
    naming: testApp.naming,
    roleHelper: new MdaaRoleHelper(testApp.testStack, testApp.naming),
  };

  new QuickSightProjectL3Construct(testApp.testStack, 'test-stack', constructProps);
  testApp.checkCdkNagCompliance(testApp.testStack);
  const template = Template.fromStack(testApp.testStack);

  test('Creates the KMS policy without any S3 statements when only kmsKeyArns is provided', () => {
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      ManagedPolicyName: testApp.naming
        .withResourceType(MdaaResourceType.IAM_POLICY)
        .resourceName('qs-resource-access'),
      PolicyDocument: {
        Statement: [
          Match.objectLike({
            Sid: 'KmsDataAccess',
            Action: Match.arrayWith(['kms:Decrypt']),
            Resource: 'arn:test-partition:kms:test-region:test-account:key/test-key-id',
          }),
        ],
      },
    });
  });
});

describe('Resource Access Role Permissions Empty Tests', () => {
  const testApp = new MdaaTestApp();
  const constructProps: QuickSightProjectL3ConstructProps = {
    principals: {
      READERS_GROUP: 'arn:test-partition:quicksight:test-region:test-account:group/testNamespace/testReaderOnlyQSGroup',
    },
    resourceAccessRolePermissions: {},
    naming: testApp.naming,
    roleHelper: new MdaaRoleHelper(testApp.testStack, testApp.naming),
  };

  new QuickSightProjectL3Construct(testApp.testStack, 'test-stack', constructProps);
  testApp.checkCdkNagCompliance(testApp.testStack);
  const template = Template.fromStack(testApp.testStack);

  test('Does not create a data-access managed policy when no S3/KMS ARNs are provided', () => {
    const policies = template.findResources('AWS::IAM::ManagedPolicy', {
      Properties: {
        ManagedPolicyName: testApp.naming
          .withResourceType(MdaaResourceType.IAM_POLICY)
          .resourceName('qs-resource-access'),
      },
    });
    expect(Object.keys(policies)).toHaveLength(0);
  });
});
