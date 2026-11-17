import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { resourceName, type Environment } from "../../config";

export interface DataProps {
  environment: Environment;
  /** dev stacks are disposable; prod keeps data on destroy. */
  isProd: boolean;
}

/** Single DynamoDB table and the uploads bucket. */
export class Data extends Construct {
  readonly table: dynamodb.Table;
  readonly uploadsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataProps) {
    super(scope, id);
    const removalPolicy = props.isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    this.table = new dynamodb.Table(this, "Table", {
      tableName: resourceName(props.environment, "data"),
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      // Tombstones for deleted users expire a day after deletion (item attribute `expiresAt`, epoch seconds).
      timeToLiveAttribute: "expiresAt",
      removalPolicy,
    });

    this.uploadsBucket = new s3.Bucket(this, "UploadsBucket", {
      bucketName: `${resourceName(props.environment, "uploads")}-${cdk.Aws.ACCOUNT_ID}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: !props.isProd,
      lifecycleRules: [
        { id: "expire-attachments", prefix: "attachments/", expiration: cdk.Duration.days(30) },
        // Workspace uploads land here first; the API copies accepted files to workspaces/ and abandoned ones vanish.
        { id: "expire-staging", prefix: "staging/", expiration: cdk.Duration.days(1) },
      ],
      // The browser PUTs straight to S3 with a presigned URL. The distribution domain cannot be
      // referenced here without a cycle (bucket -> lambdas -> function URLs -> distribution -> ...),
      // so the origin is "*". Access still needs a valid presigned signature (5 minute expiry,
      // key and size fixed by the API Lambda), and only PUT is allowed, so this does not widen access.
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
    });
    NagSuppressions.addResourceSuppressions(this.uploadsBucket, [
      { id: "AwsSolutions-S1", reason: "Demo-scale app: server access logging would cost more than the data it describes. Object access is already audited by CloudTrail data events if enabled." },
    ]);
  }
}
