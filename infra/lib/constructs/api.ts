import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { resourceName, type Environment } from "../../config";

const BACKEND_DIR = path.resolve(__dirname, "..", "..", "..", "backend");

/**
 * Shared esbuild settings: one ESM bundle per function, SDK bundled so versions are pinned.
 * Function, role and log group are created here with explicit names (`genie-{env}-{part}`) so nothing is auto-named.
 */
export function backendFunction(
  scope: Construct,
  id: string,
  entry: string,
  naming: { environment: Environment; part: string },
  props: Partial<nodejs.NodejsFunctionProps>,
): nodejs.NodejsFunction {
  const functionName = resourceName(naming.environment, naming.part);
  const role = new iam.Role(scope, `${id}Role`, {
    roleName: `${functionName}-role`,
    assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")],
  });
  return new nodejs.NodejsFunction(scope, id, {
    functionName,
    role,
    entry: path.join(BACKEND_DIR, "src", entry),
    projectRoot: BACKEND_DIR,
    depsLockFilePath: path.join(BACKEND_DIR, "package-lock.json"),
    handler: "handler",
    runtime: lambda.Runtime.NODEJS_22_X,
    architecture: lambda.Architecture.ARM_64,
    logGroup: new logs.LogGroup(scope, `${id}Logs`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    }),
    bundling: {
      minify: true,
      sourceMap: true,
      format: nodejs.OutputFormat.ESM,
      target: "node22",
      mainFields: ["module", "main"],
      externalModules: [],
      banner: "import{createRequire as __cr}from'module';const require=__cr(import.meta.url);",
    },
    ...props,
  });
}

export interface ApiProps {
  environment: Environment;
  table: dynamodb.ITable;
  uploadsBucket: s3.IBucket;
  knowledgeBaseArn: string;
  knowledgeBaseId: string;
  dataSourceId: string;
  /** Reported by the public config endpoint so the sign-in screen knows whether email codes exist. */
  emailOtp: boolean;
  /**
   * Reserved concurrency (cost and abuse guard). Reserving carves it out of the account quota and AWS requires
   * 100 to stay unreserved, so a new account with the default low quota (e.g. 10) must lower these or request
   * an increase. Pass undefined to leave the function unreserved.
   */
  chatReservedConcurrency?: number;
  apiReservedConcurrency?: number;
}

/** REST and streaming chat Lambdas with their Function URLs and least-privilege IAM. */
export class Api extends Construct {
  readonly apiFunction: nodejs.NodejsFunction;
  readonly chatFunction: nodejs.NodejsFunction;
  readonly apiUrl: lambda.FunctionUrl;
  readonly chatUrl: lambda.FunctionUrl;
  /** Plain string: the pool lives in a stack part that depends on these Lambdas, so no token reference is allowed. */
  readonly authParameterName: string;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);
    const stack = cdk.Stack.of(this);
    this.authParameterName = `/genie/${props.environment}/auth`;

    const environment = {
      TABLE_NAME: props.table.tableName,
      UPLOADS_BUCKET: props.uploadsBucket.bucketName,
      AUTH_PARAMETER_NAME: this.authParameterName,
      KNOWLEDGE_BASE_ID: props.knowledgeBaseId,
      DATA_SOURCE_ID: props.dataSourceId,
      // CORS: the site and API share the CloudFront origin, and auth is a bearer token (no cookies),
      // so "*" is safe. The exact origin cannot be passed in without a cycle with the distribution.
      ALLOWED_ORIGIN: "*",
      EMAIL_OTP: props.emailOtp ? "true" : "false",
      NODE_OPTIONS: "--enable-source-maps",
    };

    this.apiFunction = backendFunction(this, "ApiFunction", "api/handler.ts", { environment: props.environment, part: "api" }, {
      memorySize: 1024,
      timeout: cdk.Duration.seconds(29),
      environment,
      reservedConcurrentExecutions: props.apiReservedConcurrency,
    });
    this.chatFunction = backendFunction(this, "ChatFunction", "chat/handler.ts", { environment: props.environment, part: "chat" }, {
      memorySize: 1024,
      timeout: cdk.Duration.seconds(900),
      environment,
      reservedConcurrentExecutions: props.chatReservedConcurrency,
    });

    this.apiUrl = this.apiFunction.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });
    this.chatUrl = this.chatFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    for (const fn of [this.apiFunction, this.chatFunction]) {
      props.table.grantReadWriteData(fn);
      props.uploadsBucket.grantReadWrite(fn);
      fn.addToRolePolicy(this.bedrockInvoke());
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["ssm:GetParameter"],
          resources: [`arn:${stack.partition}:ssm:${stack.region}:${stack.account}:parameter${this.authParameterName}`],
        }),
      );
    }
    this.chatFunction.addToRolePolicy(new iam.PolicyStatement({ actions: ["bedrock:Retrieve"], resources: [props.knowledgeBaseArn] }));
    this.apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:StartIngestionJob", "bedrock:GetIngestionJob", "bedrock:ListIngestionJobs"],
        resources: [props.knowledgeBaseArn],
      }),
    );
    this.apiFunction.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["bedrock:ListFoundationModels", "bedrock:ListInferenceProfiles"], resources: ["*"] }),
    );
    // Wildcard pool: the pool is created after the distribution, which depends on this Lambda.
    this.apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:ListUsers",
          "cognito-idp:ListUsersInGroup",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:AdminEnableUser",
          "cognito-idp:AdminDisableUser",
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminResetUserPassword",
          "cognito-idp:AdminListGroupsForUser",
          "cognito-idp:AdminUserGlobalSignOut",
        ],
        resources: [`arn:${stack.partition}:cognito-idp:${stack.region}:${stack.account}:userpool/*`],
      }),
    );
    this.addSuppressions();
  }

  private bedrockInvoke(): iam.PolicyStatement {
    const stack = cdk.Stack.of(this);
    return new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      resources: [
        `arn:${stack.partition}:bedrock:*::foundation-model/*`,
        `arn:${stack.partition}:bedrock:*:${stack.account}:inference-profile/*`,
        `arn:${stack.partition}:bedrock:*:${stack.account}:application-inference-profile/*`,
      ],
    });
  }

  private addSuppressions(): void {
    for (const fn of [this.apiFunction, this.chatFunction]) {
      NagSuppressions.addResourceSuppressions(
        [fn, fn.role as iam.IRole],
        [
          { id: "AwsSolutions-IAM4", reason: "AWSLambdaBasicExecutionRole is the standard managed policy for CloudWatch Logs.", appliesTo: ["Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"] },
          {
            id: "AwsSolutions-IAM5",
            reason:
              "Wildcards are inherent: the admin catalog can use any Bedrock foundation model or inference profile (and models are added at runtime), S3 grants cover object keys, the Cognito pool ARN is wildcarded in this account to avoid a pool/CloudFront cycle, and List* Bedrock actions have no resource-level scoping.",
          },
          { id: "AwsSolutions-L1", reason: "Node.js 22 is the runtime required by the project spec and is a supported LTS release." },
        ],
        true,
      );
    }
  }
}
