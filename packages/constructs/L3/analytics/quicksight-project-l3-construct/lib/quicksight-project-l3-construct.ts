/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaL3Construct, MdaaL3ConstructProps } from '@aws-mdaa/l3-construct';
import { MdaaResourceType } from '@aws-mdaa/naming';
import { MdaaLambdaFunction, MdaaLambdaRole } from '@aws-mdaa/lambda-constructs';
import { MdaaManagedPolicy, MdaaRole } from '@aws-mdaa/iam-constructs';
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Code, Runtime } from 'aws-cdk-lib/aws-lambda';
import { CustomResource, Duration } from 'aws-cdk-lib';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { MdaaNagSuppressions } from '@aws-mdaa/construct'; //NOSONAR
import { Construct } from 'constructs';
import { MdaaQuickSightDataSource } from '@aws-mdaa/quicksight-constructs';
import { ConfigurationElement } from '@aws-mdaa/config';
//Interfaces for Shared Folders
export type FolderActions = 'READER_FOLDER' | 'AUTHOR_FOLDER';

/**
 * Permission entry for a QuickSight shared folder, mapping a principal to a folder action.
 *
 * Use cases: Folder read access for consumers; Author access for BI developers
 *
 * AWS: QuickSight shared folder permissions
 *
 * Validation: Both principal and actions are required
 */
export interface SharedFoldersPermissionsProps {
  /**
   * Principal name referencing a QuickSight user or group from the project's principals map.
   *
   * Use cases: Group-based folder access; User-specific permissions
   *
   * AWS: QuickSight principal (user or group)
   *
   * Validation: Required; must match a key in the project principals configuration
   */
  readonly principal: string;
  /**
   * Folder permission level granted to the principal.
   *
   * Use cases: Read-only dashboard consumers; Full authoring access for BI developers
   *
   * AWS: QuickSight folder actions (DescribeFolder for READER, full CRUD for AUTHOR)
   *
   * Validation: Required; 'READER_FOLDER' | 'AUTHOR_FOLDER'
   */
  readonly actions: FolderActions;
}
/**
 * Shared folder configuration with permissions and optional nested sub-folders.
 * Folders organize QuickSight assets (dashboards, analyses, datasets) with
 * hierarchical structure and per-folder access control.
 *
 * Use cases: Environment-based folder hierarchy (dev/test/prod); Team workspace isolation; Asset organization
 *
 * AWS: QuickSight shared folders via custom resource
 *
 * Validation: permissions required; folders optional for nesting
 */
export interface SharedFoldersProps {
  /**
   * Permission entries controlling who can access this folder and at what level.
   *
   * Use cases: Multi-group access control; Reader/Author separation per folder
   *
   * AWS: QuickSight folder permissions
   *
   * Validation: Required; array of SharedFoldersPermissionsProps
   */
  readonly permissions: SharedFoldersPermissionsProps[];
  /**
   * Nested child folders inheriting the parent's organizational context.
   * Each child folder has its own permissions and can contain further sub-folders.
   *
   * Use cases: Working/publishing sub-folder separation; Hierarchical asset organization
   *
   * AWS: QuickSight nested shared folders
   *
   * Validation: Optional; map of folder name to SharedFoldersProps
   */
  readonly folders?: { [key: string]: SharedFoldersProps };
}
interface FolderDetailPermissionsProps {
  readonly Principal?: string;
  readonly Actions?: string[];
}
interface FolderDetailProps {
  readonly folderName: string;
  readonly folderPermissions: FolderDetailPermissionsProps[];
  readonly folderNameWithParentName: string;
  readonly parentFolderArn?: string;
}
//Interfaces for DataSource
export type DataSourceActions = 'READER_DATA_SOURCE' | 'AUTHOR_DATA_SOURCE';
/**
 * Permission entry for a QuickSight data source, mapping a principal to a data source action.
 *
 * Use cases: Read-only data source access; Full author access for data source management
 *
 * AWS: QuickSight data source permissions
 *
 * Validation: Both actions and principal are required
 */
export interface DataSourcePermissionsProps {
  /**
   * Either "READER_DATA_SOURCE" or "AUTHOR_DATA_SOURCE"
   */
  readonly actions: DataSourceActions;
  /**
   * The Amazon Resource Name (ARN) of the principal.
   */
  readonly principal: string;
}
export interface DataSourcePermissions2Props {
  /**
   * API Actions for "READER_DATA_SOURCE" or "AUTHOR_DATA_SOURCE"
   */
  readonly actions: string[];
  /**
   * The Amazon Resource Name (ARN) of the principal.
   */
  readonly principal: string;
}
/**
 * Error information for a QuickSight data source connection failure.
 *
 * Use cases: Data source troubleshooting; Connection error diagnosis
 *
 * AWS: QuickSight data source error info
 *
 * Validation: Both fields optional
 */
export interface DataSourceErrorInfoProps {
  /**
   * Error message(Optional)
   */
  readonly message?: string;
  /**
   * Error type.(Optional)
   * Valid Values are: ACCESS_DENIED | CONFLICT | COPY_SOURCE_NOT_FOUND | ENGINE_VERSION_NOT_SUPPORTED | GENERIC_SQL_FAILURE | TIMEOUT | UNKNOWN | UNKNOWN_HOST
   */
  readonly type?: string;
}
/**
 * Username/password credential pair for QuickSight data source authentication.
 *
 * Use cases: Database authentication; Redshift/RDS credential-based connections
 *
 * AWS: QuickSight data source credential pair
 *
 * Validation: password and username required; alternateDataSourceParameters optional
 */
export interface DataSourceCredentialPairProps {
  /**
   * Password for data source authentication. Can use dynamic references
   * (e.g., resolve:secretsmanager) for secure credential retrieval.
   *
   * Use cases: Database password; Secret manager dynamic reference
   *
   * AWS: QuickSight data source credential
   *
   * Validation: Required; non-empty string
   */
  readonly password: string;
  /**
   * Username for data source authentication.
   *
   * Use cases: Database user identity; Service account access
   *
   * AWS: QuickSight data source credential
   *
   * Validation: Required; non-empty string
   */
  readonly username: string;
  /**
   * Alternate data source parameters for credential sharing across multiple data sources.
   *
   * Use cases: Multi-source credential reuse; Alternate host configuration
   *
   * AWS: QuickSight alternate data source parameters
   *
   * Validation: Optional; array of parameter objects
   */
  /** @jsii ignore */
  readonly alternateDataSourceParameters?: [
    {
      /** @jsii ignore */
      [key: string]: unknown;
    },
  ];
}
/**
 * Credentials for a QuickSight data source. Supports secret ARN (recommended for rotation),
 * credential pair, or copying credentials from another data source.
 *
 * Use cases: Secret-based authentication; Direct credential pair; Cross-source credential sharing
 *
 * AWS: QuickSight CfnDataSource.DataSourceCredentialsProperty
 *
 * Validation: Provide one of secretArn, credentialPair, or copySourceArn
 */
export interface DataSourceCredentialsProps {
  /**
   * The Amazon Resource Name (ARN) of a data source that has the credential pair that you want to use.
   */
  readonly copySourceArn?: string;
  /**
   * Credential pair. For more information, see [CredentialPair](https://docs.aws.amazon.com/quicksight/latest/APIReference/API_CredentialPair.html) .
   */
  readonly credentialPair?: DataSourceCredentialPairProps;
  /**
   * CfnDataSource.DataSourceCredentialsProperty.SecretArn.
   */
  readonly secretArn?: string;
}
export type DataSourceTypeProps =
  | 'ADOBE_ANALYTICS'
  | 'AMAZON_ELASTICSEARCH'
  | 'AMAZON_OPENSEARCH'
  | 'ATHENA'
  | 'AURORA'
  | 'AURORA_POSTGRESQL'
  | 'AWS_IOT_ANALYTICS'
  | 'DATABRICKS'
  | 'EXASOL'
  | 'GITHUB'
  | 'JIRA'
  | 'MARIADB'
  | 'MYSQL'
  | 'ORACLE'
  | 'POSTGRESQL'
  | 'PRESTO'
  | 'REDSHIFT'
  | 'S3'
  | 'SALESFORCE'
  | 'SERVICENOW'
  | 'SNOWFLAKE'
  | 'SPARK'
  | 'SQLSERVER'
  | 'TERADATA'
  | 'TIMESTREAM'
  | 'TWITTER';
/**
 * SSL configuration for a QuickSight data source connection.
 *
 * Use cases: Disabling SSL for internal/test data sources; Enforcing encrypted connections
 *
 * AWS: QuickSight CfnDataSource.SslProperties
 *
 * Validation: disableSsl required; boolean
 */
export interface DataSourceSSLProps {
  /**
   * Enable to Disable SSL: Default value is false(SSL is enabled)
   */
  readonly disableSsl: boolean;
}
/**
 * VPC connection properties for a QuickSight data source requiring private network access.
 *
 * Use cases: Redshift in VPC; RDS private connectivity
 *
 * AWS: QuickSight CfnDataSource.VpcConnectionProperties
 *
 * Validation: vpcConnectionArn required; must reference existing QuickSight VPC connection
 */
export interface DataSourceVPCProps {
  /**
   * QuickSight VPC(created in QS) ARN
   */
  readonly vpcConnectionArn: string;
}
/**
 * Core data source configuration for QuickSight, defining connection parameters,
 * credentials, permissions, and optional SSL/VPC settings.
 *
 * Use cases: Redshift data source; Athena data source; S3/RDS connectivity
 *
 * AWS: QuickSight CfnDataSource
 *
 * Validation: dataSourceSpecificParameters, displayName, and permissions required
 */
export interface DataSourceProps {
  readonly dataSourceSpecificParameters: ConfigurationElement;
  /**
   * The AWS account ID.
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-quicksight-datasource.html#cfn-quicksight-datasource-awsaccountid
   */
  readonly awsAccountId?: string;
  /**
   * The credentials Amazon QuickSight that uses to connect to your underlying source. Currently, only credentials based on user name and password are supported.
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-quicksight-datasource.html#cfn-quicksight-datasource-credentials
   */
  readonly credentials?: DataSourceCredentialsProps;
  /**
   * Error information from the last update or the creation of the data source.
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-quicksight-datasource.html#cfn-quicksight-datasource-errorinfo
   */
  readonly errorInfo?: DataSourceErrorInfoProps;
  /**
   * A display name for the data source.
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-quicksight-datasource.html#cfn-quicksight-datasource-name
   */
  readonly displayName: string;
  /**
   * A list of resource permissions on the data source.
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-quicksight-datasource.html#cfn-quicksight-datasource-permissions
   */
  readonly permissions: DataSourcePermissionsProps[];
  /**
   * Secure Socket Layer (SSL) properties that apply when Amazon QuickSight connects to your underlying source.
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-quicksight-datasource.html#cfn-quicksight-datasource-sslproperties
   */
  readonly sslProperties?: DataSourceSSLProps;
  /**
   * Use this parameter only when you want Amazon QuickSight to use a VPC connection when connecting to your underlying source.
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-quicksight-datasource.html#cfn-quicksight-datasource-vpcconnectionproperties
   */
  readonly vpcConnectionProperties?: DataSourceVPCProps;
  /**
   * Secrets Manager authentication for the data source. When set, MDAA both (a) wires the
   * secret as the data source credentials, and (b) grants QuickSight's account-level Secrets
   * Manager role (`aws-quicksight-secretsmanager-role-v0`) read access to the secret (and
   * decrypt on its KMS key). This is the single toggle for the secret-based auth path — the
   * role name and all IAM wiring are handled automatically.
   *
   * Use cases: Secret-based Redshift (or other credential-pair) data source authentication
   *
   * AWS: QuickSight DataSourceCredentials.SecretArn + IAM grant on the QuickSight SM role
   *
   * Validation: Optional; when present, `arn` is required
   */
  readonly secretsManager?: SecretsManagerAuthProps;
}

/**
 * Secrets Manager authentication configuration for a QuickSight data source.
 *
 * Use cases: Authenticating a Redshift data source with a stored secret instead of IAM
 *
 * AWS: Secrets Manager secret consumed by QuickSight, read via the QuickSight SM role
 *
 * Validation: `arn` is required; `kmsKeyArns` is required only if the secret is encrypted
 * with a customer-managed KMS key
 */
export interface SecretsManagerAuthProps {
  /**
   * ARN of the Secrets Manager secret holding the data source credentials. Used both as the
   * QuickSight data source credential and to scope the IAM read grant on the QuickSight
   * Secrets Manager role.
   *
   * Use cases: Redshift service-user credentials secret
   *
   * AWS: Secrets Manager secret ARN
   *
   * Validation: Required
   */
  readonly arn: string;
  /**
   * KMS key ARNs encrypting the secret. QuickSight's Secrets Manager role is granted decrypt
   * on these so it can read a customer-managed-key-encrypted secret.
   *
   * Use cases: Decrypting a CMK-encrypted credentials secret
   *
   * AWS: IAM kms:Decrypt permission on the QuickSight Secrets Manager role
   *
   * Validation: Optional; required only for CMK-encrypted secrets
   */
  readonly kmsKeyArns?: string[];
}
export interface DataSourceWithIdAndTypeProps extends DataSourceProps {
  /**
   * Type of Data Source. ADOBE_ANALYTICS | AMAZON_ELASTICSEARCH | AMAZON_OPENSEARCH | ATHENA | AURORA | AURORA_POSTGRESQL | AWS_IOT_ANALYTICS | DATABRICKS | EXASOL | GITHUB | JIRA | MARIADB | MYSQL | ORACLE | POSTGRESQL | PRESTO | REDSHIFT | S3 | SALESFORCE | SERVICENOW | SNOWFLAKE | SPARK | SQLSERVER | TERADATA | TIMESTREAM | TWITTER
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-quicksight-datasource.html#cfn-quicksight-datasource-sslproperties
   */
  readonly type: Record<DataSourceTypeProps, string>[DataSourceTypeProps];
  /**
   * An ID for the data source. This ID is unique per AWS Region for each AWS account.
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-quicksight-datasource.html#cfn-quicksight-datasource-datasourceid
   */
  readonly dataSourceId: string;
}
/**
 * Customer-managed S3/KMS permissions to attach to QuickSight's account-level resource-access
 * role so this project's data sources can read the data they query.
 *
 * The role itself (typically `aws-quicksight-service-role-v0`) is created by the
 * `@aws-mdaa/quicksight-account` module, which also attaches any AWS-managed policies (it owns
 * the role). This module attaches the data-source-specific S3/KMS grants as a customer-managed
 * policy on the (imported) role, since only the data source knows which buckets/keys it needs and
 * those references resolve only after the data lake / Athena modules deploy.
 *
 * Use cases: Granting an Athena data source read/write on its results bucket and decrypt on the
 * KMS-encrypted data lake it queries
 *
 * AWS: IAM ManagedPolicy attached to the QuickSight resource-access role
 *
 * Validation: all fields optional. The role is always the standard QuickSight resource-access
 * role (aws-quicksight-service-role-v0), so it is not configurable here.
 */
export interface ResourceAccessRolePermissionsProps {
  /**
   * S3 bucket ARNs the data source must read (and write, for Athena query results). Grants
   * List/Get on the buckets and their objects, plus Put for query results.
   *
   * Use cases: Data lake bucket access; Athena query-results bucket access
   *
   * AWS: IAM S3 permissions on the QuickSight resource-access role
   *
   * Validation: Optional; array of S3 bucket ARNs (arn:aws:s3:::bucket-name)
   */
  readonly s3BucketArns?: string[];
  /**
   * KMS key ARNs the data source must use to decrypt KMS-encrypted data and query results.
   *
   * Use cases: Decrypting KMS-encrypted data lake objects and Athena results
   *
   * AWS: IAM KMS permissions on the QuickSight resource-access role
   *
   * Validation: Optional; array of KMS key ARNs
   */
  readonly kmsKeyArns?: string[];
}

export interface QuickSightProjectL3ConstructProps extends MdaaL3ConstructProps {
  /** Data source configurations for the QuickSight project. */
  readonly dataSources?: DataSourceWithIdAndTypeProps[];
  /** Map of principal names to QuickSight user/group ARNs for permissions. */
  readonly principals: { [key: string]: string };
  /** Map of folder names to shared folder configurations. */
  readonly sharedFolders?: { [key: string]: SharedFoldersProps };
  /**
   * Optional S3/KMS permissions to attach to QuickSight's account-level resource-access role so
   * this project's data sources can read the data they query. See
   * {@link ResourceAccessRolePermissionsProps}.
   */
  readonly resourceAccessRolePermissions?: ResourceAccessRolePermissionsProps;
}

export class QuickSightProjectL3Construct extends MdaaL3Construct {
  protected readonly props: QuickSightProjectL3ConstructProps;

  /**
   * QuickSight's account-level Secrets Manager role, created (by name) when Secrets Manager
   * access is enabled in the QuickSight console. QuickSight assumes it to read secrets backing
   * data sources.
   */
  public static readonly SECRETS_MANAGER_ROLE_NAME = 'aws-quicksight-secretsmanager-role-v0';

  /**
   * QuickSight's account-level resource-access role (created by the quicksight-account module).
   * Athena data sources assume this role to reach Athena/S3, so it is used as the default
   * `roleArn` for Athena parameters unless the config provides an explicit override.
   */
  public static readonly RESOURCE_ACCESS_ROLE_NAME = 'aws-quicksight-service-role-v0';

  public static readonly sharedFoldersActions: { [key: string]: string[] } = {
    READER_FOLDER: ['quicksight:DescribeFolder'],
    AUTHOR_FOLDER: [
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
  };
  public static readonly dataSourceActions: { [key: string]: string[] } = {
    READER_DATA_SOURCE: [
      'quicksight:DescribeDataSource',
      'quicksight:DescribeDataSourcePermissions',
      'quicksight:PassDataSource',
    ],
    AUTHOR_DATA_SOURCE: [
      'quicksight:DescribeDataSource',
      'quicksight:DescribeDataSourcePermissions',
      'quicksight:PassDataSource',
      'quicksight:UpdateDataSource',
      'quicksight:DeleteDataSource',
      'quicksight:UpdateDataSourcePermissions',
    ],
  };

  constructor(scope: Construct, id: string, props: QuickSightProjectL3ConstructProps) {
    super(scope, id, props);
    this.props = props;
    //Create QS Data Sources
    if (this.props.dataSources) {
      const DataSourceWithIdAndTypeProps: DataSourceWithIdAndTypeProps[] = this.props.dataSources;
      this.createQSDataSource(DataSourceWithIdAndTypeProps);
    }
    //Create QS Shared Folders
    if (this.props.sharedFolders) {
      const arraySharedFolders: { [key: string]: SharedFoldersProps } = this.props.sharedFolders;
      const qsFolderProvider: Provider = this.createQSFoldersProvider();
      this.createQSFolders(qsFolderProvider, arraySharedFolders);
    }
    //Attach S3/KMS data-access permissions to the QuickSight resource-access role
    if (this.props.resourceAccessRolePermissions) {
      this.attachResourceAccessRolePermissions(this.props.resourceAccessRolePermissions);
    }
  }

  /**
   * Attaches a customer-managed S3/KMS policy to QuickSight's account-level resource-access role
   * (created by the quicksight-account module) so this project's data sources can read the data
   * they query. The role is imported by name; a dedicated ManagedPolicy referencing the role is
   * created, which attaches correctly even though this module does not own the role.
   */
  private attachResourceAccessRolePermissions(config: ResourceAccessRolePermissionsProps): void {
    const s3BucketArns = config.s3BucketArns || [];
    const kmsKeyArns = config.kmsKeyArns || [];
    if (s3BucketArns.length === 0 && kmsKeyArns.length === 0) {
      return;
    }

    const role = Role.fromRoleName(
      this,
      'resource-access-role',
      QuickSightProjectL3Construct.RESOURCE_ACCESS_ROLE_NAME,
      { mutable: true },
    );

    const dataAccessPolicy = new MdaaManagedPolicy(this, 'resource-access-data-policy', {
      managedPolicyName: 'qs-resource-access',
      roles: [role],
      naming: this.props.naming,
    });

    if (s3BucketArns.length > 0) {
      const objectArns = s3BucketArns.map(bucketArn => `${bucketArn}/*`);
      dataAccessPolicy.addStatements(
        new PolicyStatement({
          sid: 'S3ListAllBuckets',
          effect: Effect.ALLOW,
          actions: ['s3:ListAllMyBuckets'],
          resources: [`arn:${this.partition}:s3:::*`],
        }),
        new PolicyStatement({
          sid: 'S3BucketAccess',
          effect: Effect.ALLOW,
          actions: ['s3:ListBucket', 's3:GetBucketLocation', 's3:ListBucketMultipartUploads'],
          resources: s3BucketArns,
        }),
        new PolicyStatement({
          sid: 'S3ObjectAccess',
          effect: Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:GetObjectVersion',
            's3:PutObject',
            's3:AbortMultipartUpload',
            's3:ListMultipartUploadParts',
          ],
          resources: objectArns,
        }),
      );
    }

    if (kmsKeyArns.length > 0) {
      dataAccessPolicy.addStatements(
        new PolicyStatement({
          sid: 'KmsDataAccess',
          effect: Effect.ALLOW,
          actions: ['kms:Decrypt', 'kms:GenerateDataKey', 'kms:DescribeKey'],
          resources: kmsKeyArns,
        }),
      );
    }

    MdaaNagSuppressions.addCodeResourceSuppressions(
      dataAccessPolicy,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            's3:ListAllMyBuckets does not support resource-level permissions and requires a wildcard resource ' +
            '(see https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazons3.html). ' +
            'Object-level actions are scoped to the configured bucket ARNs, where bucket/* is the narrowest scope possible.',
          appliesTo: [{ regex: String.raw`/^Resource::arn:.*:s3:::\*$/` }, { regex: String.raw`/^Resource::.*\/\*$/` }],
        },
      ],
      true,
    );
  }

  // Creates Custom Resource per Shared Folder - Handles OnCreate, OnUpdate, OnDelete Stack Events
  private createQSFoldersCr(qsFolderProvider: Provider, folderDetail: FolderDetailProps): CustomResource {
    return new CustomResource(this, `qsFolders-${folderDetail.folderNameWithParentName}`, {
      serviceToken: qsFolderProvider.serviceToken,
      properties: {
        folderDetails: folderDetail,
      },
    });
  }

  private createQSFoldersProvider(): Provider {
    //Create a role which will be used by the QSFolders Custom Resource Lambda Function
    const qsFoldersCrRole = new MdaaLambdaRole(this, 'qsFolders-cr-role', {
      description: 'CR Lambda Role',
      roleName: 'qsFolders-cr',
      naming: this.props.naming,
      logGroupNames: [this.props.naming.resourceName('qsFolders-cr-func')],
      createParams: false,
      createOutputs: false,
    });

    const qsFoldersCrManagedPolicy = new ManagedPolicy(this, 'qsFolders-cr-lambda', {
      managedPolicyName: this.props.naming
        .withResourceType(MdaaResourceType.IAM_POLICY)
        .resourceName('qsFolders-cr-lambda'),
      roles: [qsFoldersCrRole],
    });

    const qsFoldersPolicyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [`arn:${this.partition}:quicksight:${this.region}:${this.account}:folder/*`],
      actions: [
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
    });
    qsFoldersCrManagedPolicy.addStatements(qsFoldersPolicyStatement);
    const qsFoldersPolicyStatement2 = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [`arn:${this.partition}:quicksight:${this.region}:${this.account}:folder/*`],
      actions: ['quicksight:CreateFolderMembership', 'quicksight:DeleteFolderMembership'],
    });
    qsFoldersCrManagedPolicy.addStatements(qsFoldersPolicyStatement2);

    MdaaNagSuppressions.addCodeResourceSuppressions(
      qsFoldersCrManagedPolicy,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'ds:CreateIdentityPoolDirectory,ds:DescribeDirectories - Takes no resource.',
        },
      ],
      true,
    );
    const srcDir = `${__dirname}/../src/python/quicksight_folders`;
    // This Lambda is used as a Custom Resource in order to create the QuickSight Folders
    const quicksightFoldersCrLambda = new MdaaLambdaFunction(this, 'qsFolders-cr-func', {
      functionName: 'qsFolders-cr-func',
      naming: this.props.naming,
      code: Code.fromAsset(srcDir),
      handler: 'quicksight_folders.lambda_handler',
      runtime: Runtime.PYTHON_3_14,
      timeout: Duration.seconds(120),
      environment: {
        ACCOUNT_ID: this.account,
        LOG_LEVEL: 'INFO',
      },
      role: qsFoldersCrRole,
    });

    MdaaNagSuppressions.addCodeResourceSuppressions(
      quicksightFoldersCrLambda,
      [
        {
          id: 'NIST.800.53.R5-LambdaDLQ',
          reason: 'Function is for custom resource and error handling will be handled by CloudFormation.',
        },
        {
          id: 'NIST.800.53.R5-LambdaInsideVPC',
          reason: 'Function is for custom resource and will interact only with QuickSight APIs.',
        },
        {
          id: 'NIST.800.53.R5-LambdaConcurrency',
          reason:
            'Function is for custom resource and will only execute during stack deployement. Reserved concurrency not appropriate.',
        },
        {
          id: 'HIPAA.Security-LambdaDLQ',
          reason: 'Function is for custom resource and error handling will be handled by CloudFormation.',
        },
        {
          id: 'HIPAA.Security-LambdaInsideVPC',
          reason: 'Function is for custom resource and will interact only with QuickSight APIs.',
        },
        {
          id: 'HIPAA.Security-LambdaConcurrency',
          reason:
            'Function is for custom resource and will only execute during stack deployement. Reserved concurrency not appropriate.',
        },
        {
          id: 'PCI.DSS.321-LambdaDLQ',
          reason: 'Function is for custom resource and error handling will be handled by CloudFormation.',
        },
        {
          id: 'PCI.DSS.321-LambdaInsideVPC',
          reason: 'Function is for custom resource and will interact only with QuickSight APIs.',
        },
        {
          id: 'PCI.DSS.321-LambdaConcurrency',
          reason:
            'Function is for custom resource and will only execute during stack deployement. Reserved concurrency not appropriate.',
        },
      ],
      true,
    );
    const qsFoldersCrProviderFunctionName = this.props.naming
      .withResourceType(MdaaResourceType.LAMBDA_FUNCTION)
      .resourceName('qsFolders-cr-prov', 64);
    const qsFoldersCrProviderRole = new MdaaLambdaRole(this, 'qsFolders-cr-prov-role', {
      description: 'CR Role',
      roleName: 'qsFolders-cr-prov',
      naming: this.props.naming,
      logGroupNames: [qsFoldersCrProviderFunctionName],
      createParams: false,
      createOutputs: false,
    });
    const qsFoldersCrProvider = new Provider(this, 'qsFolders-cr-provider', {
      providerFunctionName: qsFoldersCrProviderFunctionName,
      onEventHandler: quicksightFoldersCrLambda,
      frameworkOnEventRole: qsFoldersCrProviderRole,
    });
    MdaaNagSuppressions.addCodeResourceSuppressions(
      qsFoldersCrProviderRole,
      [
        {
          id: 'NIST.800.53.R5-IAMNoInlinePolicy',
          reason: 'Role is for Custom Resource Provider. Inline policy automatically added.',
        },
        {
          id: 'HIPAA.Security-IAMNoInlinePolicy',
          reason: 'Role is for Custom Resource Provider. Inline policy automatically added.',
        },
        {
          id: 'PCI.DSS.321-IAMNoInlinePolicy',
          reason: 'Role is for Custom Resource Provider. Inline policy automatically added.',
        },
      ],
      true,
    );

    MdaaNagSuppressions.addCodeResourceSuppressions(
      qsFoldersCrProvider,
      [
        {
          id: 'AwsSolutions-L1',
          reason: 'Lambda function Runtime set by CDK Provider Framework',
        },
        {
          id: 'NIST.800.53.R5-LambdaDLQ',
          reason: 'Function is for custom resource and error handling will be handled by CloudFormation.',
        },
        {
          id: 'NIST.800.53.R5-LambdaInsideVPC',
          reason: 'Function is for custom resource and will interact only with QuickSight APIs.',
        },
        {
          id: 'NIST.800.53.R5-LambdaConcurrency',
          reason:
            'Function is for custom resource and will only execute during stack deployement. Reserved concurrency not appropriate.',
        },
        {
          id: 'HIPAA.Security-LambdaDLQ',
          reason: 'Function is for custom resource and error handling will be handled by CloudFormation.',
        },
        {
          id: 'HIPAA.Security-LambdaInsideVPC',
          reason: 'Function is for custom resource and will interact only with QuickSight APIs.',
        },
        {
          id: 'HIPAA.Security-LambdaConcurrency',
          reason:
            'Function is for custom resource and will only execute during stack deployement. Reserved concurrency not appropriate.',
        },
        {
          id: 'PCI.DSS.321-LambdaDLQ',
          reason: 'Function is for custom resource and error handling will be handled by CloudFormation.',
        },
        {
          id: 'PCI.DSS.321-LambdaInsideVPC',
          reason: 'Function is for custom resource and will interact only with QuickSight APIs.',
        },
        {
          id: 'PCI.DSS.321-LambdaConcurrency',
          reason:
            'Function is for custom resource and will only execute during stack deployement. Reserved concurrency not appropriate.',
        },
      ],
      true,
    );
    return qsFoldersCrProvider;
  }

  //Parses Config to prepare inputs to create_folder api and recursively creates Custom Resources
  private createQSFolders(
    qsFolderProvider: Provider,
    arrSharedFolders: { [key: string]: SharedFoldersProps },
    parentFolderName?: string,
    parentFolderArn?: string,
  ): void {
    Object.keys(arrSharedFolders).forEach(folderName => {
      const folderDetails: SharedFoldersProps = arrSharedFolders[folderName];
      const fullName = parentFolderName + '/' + folderName;
      const folderNameWithParentName = fullName.replace(/^\/+/, '').replace(/\//g, '-').replace('undefined-', '');
      const returnPermissions: FolderDetailPermissionsProps[] = folderDetails.permissions.map(element => {
        const folderPermissions: FolderDetailPermissionsProps = {
          Principal: this.props.principals[element.principal],
          Actions: QuickSightProjectL3Construct.sharedFoldersActions[element.actions],
        };
        return folderPermissions;
      });
      const folderDetail: FolderDetailProps = {
        folderName: folderName,
        folderPermissions: returnPermissions,
        folderNameWithParentName: folderNameWithParentName,
        parentFolderArn: parentFolderArn,
      };
      const folderArn: string = this.createQSFoldersCr(qsFolderProvider, folderDetail).getAttString('FolderArn');
      if (folderDetails.folders) {
        //Recursion to Check if there are any sub-folders
        this.createQSFolders(qsFolderProvider, folderDetails.folders, fullName, folderArn);
      }
    });
  }

  // Creates Quicksight Data Sources
  private createQSDataSource(dataSourcesProps: DataSourceWithIdAndTypeProps[]): void {
    dataSourcesProps.forEach(dataSourceWithIdAndTypeProps => {
      const qsDataSourcePermissions: DataSourcePermissions2Props[] = dataSourceWithIdAndTypeProps.permissions.map(
        permissionDetail => {
          const qsDataSourcePermission: DataSourcePermissions2Props = {
            actions: QuickSightProjectL3Construct.dataSourceActions[permissionDetail.actions],
            principal: this.props.principals[permissionDetail.principal],
          };
          return qsDataSourcePermission;
        },
      );

      // For Redshift data sources using IAM authentication, create a QuickSight-assumable
      // role scoped to the cluster and inject its ARN. This lets the data source deploy
      // without Secrets Manager (and its one-time console enablement). Done in-code because
      // only this module knows the role is for QuickSight->Redshift IAM auth.
      const { dataSourceParameters: redshiftResolvedParams, credentialsPolicy } =
        this.maybeCreateRedshiftIamRole(dataSourceWithIdAndTypeProps);

      // For Athena data sources, default the resource-access role ARN to the account-level
      // QuickSight role (created by the quicksight-account module). The user does not need to
      // know or specify this fixed AWS role name; an explicit roleArn in config still wins.
      const dataSourceParameters = this.applyAthenaRoleDefault(
        dataSourceWithIdAndTypeProps.type,
        redshiftResolvedParams,
      );

      // For the secret-based auth path, derive the QuickSight credentials from the
      // secretsManager block and grant QuickSight's Secrets Manager role read access to the
      // secret. The user only supplies the secret (and its KMS key) once; the role name and
      // IAM wiring are handled here.
      const { credentials, secretAccessPolicy } = this.resolveSecretsManagerAuth(dataSourceWithIdAndTypeProps);

      const dataSource = new MdaaQuickSightDataSource(
        this,
        this.props.naming.resourceName(dataSourceWithIdAndTypeProps.dataSourceId),
        {
          naming: this.props.naming,
          alternateDataSourceParameters: [dataSourceParameters],
          awsAccountId: this.account,
          credentials: credentials,
          dataSourceId: this.props.naming
            .withResourceType(MdaaResourceType.QUICKSIGHT_DATASOURCE)
            .resourceName(dataSourceWithIdAndTypeProps.dataSourceId),
          dataSourceParameters: dataSourceParameters,
          errorInfo: dataSourceWithIdAndTypeProps.errorInfo,
          name: dataSourceWithIdAndTypeProps.displayName,
          permissions: qsDataSourcePermissions,
          type: dataSourceWithIdAndTypeProps.type,
          vpcConnectionProperties: dataSourceWithIdAndTypeProps.vpcConnectionProperties,
        },
      );

      // QuickSight validates the connection at create time (assuming the IAM-auth role, or
      // reading the secret via the Secrets Manager role), so the relevant permissions policy
      // must exist first. Credential/role references only create a dependency on the role
      // itself, not its managed policy, so add it explicitly.
      if (credentialsPolicy) {
        dataSource.node.addDependency(credentialsPolicy);
      }
      if (secretAccessPolicy) {
        dataSource.node.addDependency(secretAccessPolicy);
      }

      return dataSource;
    });
  }

  /**
   * Resolves Secrets Manager authentication for a data source. When `secretsManager` is set,
   * returns credentials referencing the secret ARN and creates a managed policy granting
   * QuickSight's account-level Secrets Manager role (aws-quicksight-secretsmanager-role-v0)
   * read access to the secret (and decrypt on its KMS keys). Otherwise returns the data
   * source's configured credentials unchanged and no policy.
   */
  private resolveSecretsManagerAuth(dataSource: DataSourceWithIdAndTypeProps): {
    credentials?: DataSourceCredentialsProps;
    secretAccessPolicy?: ManagedPolicy;
  } {
    const secretsManager = dataSource.secretsManager;
    if (!secretsManager) {
      return { credentials: dataSource.credentials };
    }

    const role = Role.fromRoleName(
      this,
      `qs-sm-role-${dataSource.dataSourceId}`,
      QuickSightProjectL3Construct.SECRETS_MANAGER_ROLE_NAME,
      { mutable: true },
    );

    const secretAccessPolicy = new MdaaManagedPolicy(this, `secret-access-policy-${dataSource.dataSourceId}`, {
      managedPolicyName: `qs-secret-${dataSource.dataSourceId}`,
      roles: [role],
      naming: this.props.naming,
    });
    secretAccessPolicy.addStatements(
      new PolicyStatement({
        sid: 'SecretsManagerAccess',
        effect: Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
        resources: [secretsManager.arn],
      }),
    );
    const kmsKeyArns = secretsManager.kmsKeyArns || [];
    if (kmsKeyArns.length > 0) {
      secretAccessPolicy.addStatements(
        new PolicyStatement({
          sid: 'SecretKmsDecrypt',
          effect: Effect.ALLOW,
          actions: ['kms:Decrypt', 'kms:DescribeKey'],
          resources: kmsKeyArns,
        }),
      );
    }

    return {
      credentials: { secretArn: secretsManager.arn },
      secretAccessPolicy,
    };
  }

  /**
   * If the data source is a Redshift source configured for IAM authentication
   * (`redshiftParameters.iamParameters`), create a QuickSight-assumable role with
   * `GetClusterCredentials` scoped to the configured cluster, and set the role's ARN on the
   * params. Returns the (possibly updated) data source parameters plus the role's permissions
   * policy (so the caller can order the data source after it). Non-Redshift or non-IAM-auth
   * sources return the params unchanged and no policy.
   */
  private maybeCreateRedshiftIamRole(dataSource: DataSourceWithIdAndTypeProps): {
    dataSourceParameters: ConfigurationElement;
    credentialsPolicy?: ManagedPolicy;
  } {
    const params = dataSource.dataSourceSpecificParameters;
    const redshiftParameters = params?.redshiftParameters as ConfigurationElement | undefined;
    const iamParameters = redshiftParameters?.iamParameters as ConfigurationElement | undefined;
    if (dataSource.type !== 'REDSHIFT' || !iamParameters) {
      return { dataSourceParameters: params };
    }

    const clusterId = redshiftParameters?.clusterId as string | undefined;
    // QuickSight's RedshiftIAMParameters treats DatabaseUser as optional: when AutoCreateDatabaseUser
    // is true and no DatabaseUser is set, QuickSight generates the user at runtime. In that case the
    // user name is unknown at synth time, so the dbuser resource must be a wildcard. When databaseUser
    // is configured, the dbuser resource is scoped to that specific user.
    const databaseUser = (iamParameters.databaseUser as string | undefined) || '*';
    if (!clusterId) {
      throw new Error(
        `Redshift data source '${dataSource.dataSourceId}' uses iamParameters but is missing redshiftParameters.clusterId`,
      );
    }

    const role = new MdaaRole(this, `redshift-iam-role-${dataSource.dataSourceId}`, {
      assumedBy: new ServicePrincipal('quicksight.amazonaws.com'),
      description: `QuickSight Redshift IAM auth role for ${dataSource.dataSourceId}`,
      roleName: `qs-redshift-${dataSource.dataSourceId}`,
      naming: this.props.naming,
    });

    // Use a managed policy (not inline) per CDK Nag IAMNoInlinePolicy.
    const credsPolicy = new MdaaManagedPolicy(this, `redshift-iam-policy-${dataSource.dataSourceId}`, {
      managedPolicyName: `qs-redshift-${dataSource.dataSourceId}`,
      roles: [role],
      naming: this.props.naming,
    });
    credsPolicy.addStatements(
      new PolicyStatement({
        sid: 'RedshiftGetClusterCredentials',
        effect: Effect.ALLOW,
        actions: ['redshift:GetClusterCredentials', 'redshift:CreateClusterUser', 'redshift:JoinGroup'],
        resources: [
          `arn:${this.partition}:redshift:${this.region}:${this.account}:dbuser:${clusterId}/${databaseUser}`,
          `arn:${this.partition}:redshift:${this.region}:${this.account}:dbname:${clusterId}/*`,
          `arn:${this.partition}:redshift:${this.region}:${this.account}:dbgroup:${clusterId}/*`,
        ],
      }),
      new PolicyStatement({
        sid: 'RedshiftDescribeClusters',
        effect: Effect.ALLOW,
        actions: ['redshift:DescribeClusters'],
        resources: [`arn:${this.partition}:redshift:${this.region}:${this.account}:cluster:${clusterId}`],
      }),
    );

    MdaaNagSuppressions.addCodeResourceSuppressions(
      credsPolicy,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'GetClusterCredentials, CreateClusterUser, and JoinGroup are all scoped to the specific cluster (see ' +
            'https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonredshift.html). ' +
            'The dbuser resource is scoped to the configured databaseUser; when databaseUser is omitted (QuickSight ' +
            'auto-creates the user via AutoCreateDatabaseUser), the user name is unknown at synth time so a wildcard ' +
            'is required. The dbname and dbgroup names are determined at query time, so per-database/per-group ' +
            'wildcards are also required.',
          appliesTo: [
            { regex: String.raw`/^Resource::arn:.*:redshift:.*:dbuser:.*/\*$/` },
            { regex: String.raw`/^Resource::arn:.*:redshift:.*:dbname:.*/\*$/` },
            { regex: String.raw`/^Resource::arn:.*:redshift:.*:dbgroup:.*/\*$/` },
          ],
        },
      ],
      true,
    );

    // Inject the created role's ARN into the IAM params (overriding any configured value).
    return {
      dataSourceParameters: {
        ...params,
        redshiftParameters: {
          ...redshiftParameters,
          iamParameters: {
            ...iamParameters,
            roleArn: role.roleArn,
          },
        },
      },
      credentialsPolicy: credsPolicy,
    };
  }

  /**
   * For Athena data sources, default `athenaParameters.roleArn` to the account-level
   * QuickSight resource-access role (`aws-quicksight-service-role-v0`, created by the
   * quicksight-account module). Setting this explicitly bypasses QuickSight's account-wide
   * role lookup, which fails on accounts where access to AWS resources has never been
   * configured. The user does not need to know this fixed role name. A roleArn already
   * present in the config is preserved (explicit override wins). Non-Athena sources and
   * sources without athenaParameters are returned unchanged.
   */
  private applyAthenaRoleDefault(type: string, params: ConfigurationElement): ConfigurationElement {
    const athenaParameters = params?.athenaParameters as ConfigurationElement | undefined;
    if (type !== 'ATHENA' || !athenaParameters || athenaParameters.roleArn) {
      return params;
    }
    const roleArn = `arn:${this.partition}:iam::${this.account}:role/service-role/${QuickSightProjectL3Construct.RESOURCE_ACCESS_ROLE_NAME}`;
    return {
      ...params,
      athenaParameters: {
        ...athenaParameters,
        roleArn,
      },
    };
  }
}
