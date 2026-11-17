import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { emailOtpEnabled, resourceName, type GenieConfig } from "../../config";
import { backendFunction } from "./api";

export interface AuthProps {
  config: GenieConfig;
  table: dynamodb.ITable;
  /** Passkey relying party ID: custom domain or the CloudFront domain. */
  relyingPartyId: string;
  authParameterName: string;
}

const SIGNUP_HINT = "Cognito allows 5 seconds for trigger Lambdas.";

/** User pool with passkeys, self sign-up governed by trigger Lambdas, admin group and app client. */
export class Auth extends Construct {
  readonly userPool: cognito.UserPool;
  readonly client: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthProps) {
    super(scope, id);
    const emailOtp = emailOtpEnabled(props.config);
    const triggerEnv = { TABLE_NAME: props.table.tableName, NODE_OPTIONS: "--enable-source-maps" };
    const triggerProps = { memorySize: 256, timeout: cdk.Duration.seconds(5), environment: triggerEnv, description: SIGNUP_HINT };

    const env = props.config.environment;
    const preSignUp = backendFunction(this, "PreSignUpFunction", "triggers/pre-signup.ts", { environment: env, part: "pre-signup" }, triggerProps);
    const postConfirmation = backendFunction(this, "PostConfirmationFunction", "triggers/post-confirmation.ts", { environment: env, part: "post-confirmation" }, triggerProps);
    props.table.grantReadData(preSignUp);
    props.table.grantReadWriteData(postConfirmation);

    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: resourceName(env, "users"),
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      // A changed email stays unverified-pending: the old address keeps working until the new one is confirmed.
      // writeAttributes is left at the default: restricting `email` risks breaking self sign-up, which must supply it.
      keepOriginal: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: { minLength: 8, requireLowercase: true, requireUppercase: true, requireDigits: true, requireSymbols: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: cognito.Mfa.OFF,
      signInPolicy: { allowedFirstAuthFactors: { password: true, passkey: true, emailOtp } },
      passkeyRelyingPartyId: props.relyingPartyId,
      passkeyUserVerification: cognito.PasskeyUserVerification.PREFERRED,
      lambdaTriggers: { preSignUp, postConfirmation },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    if (emailOtp) {
      // Email one-time codes need Cognito to send through the caller's SES identity (DEVELOPER mode).
      const cfn = this.userPool.node.defaultChild as cognito.CfnUserPool;
      cfn.addPropertyOverride("EmailConfiguration", {
        EmailSendingAccount: "DEVELOPER",
        From: props.config.sesFromEmail,
        SourceArn: props.config.sesIdentityArn,
      });
    }

    new cognito.CfnUserPoolGroup(this, "AdminGroup", {
      userPoolId: this.userPool.userPoolId,
      groupName: "admin",
      description: "Genie administrators",
    });

    this.client = this.userPool.addClient("WebClient", {
      userPoolClientName: resourceName(env, "web"),
      generateSecret: false,
      authFlows: { user: true, userSrp: true },
      preventUserExistenceErrors: true,
      // Short-lived tokens limit how long a suspended or demoted user keeps access; refresh keeps sessions alive.
      // Keep in step with TOKEN_VALIDITY_MINUTES in backend/src/lib/limits.ts (tombstone TTL derives from it).
      idTokenValidity: cdk.Duration.minutes(15),
      accessTokenValidity: cdk.Duration.minutes(15),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // Lambdas read this at cold start; they only know the parameter name (plain string), never the pool.
    new ssm.StringParameter(this, "AuthParameter", {
      parameterName: props.authParameterName,
      description: "Genie user pool and app client ids",
      stringValue: cdk.Stack.of(this).toJsonString({ userPoolId: this.userPool.userPoolId, userPoolClientId: this.client.userPoolClientId }),
    });

    this.addSuppressions([preSignUp, postConfirmation]);
  }

  private addSuppressions(triggers: Construct[]): void {
    NagSuppressions.addResourceSuppressions(this.userPool, [
      { id: "AwsSolutions-COG2", reason: "MFA is intentionally off: passkeys with user verification are the strong factor, and Cognito does not combine passwordless first factors with MFA per user." },
      { id: "AwsSolutions-COG3", reason: "Advanced security (Plus plan) is not required for this demo app and would add per-user cost." },
      { id: "AwsSolutions-COG8", reason: "Passkeys only need the ESSENTIALS plan. Plus adds threat protection that costs per user and is not needed at demo scale." },
    ]);
    for (const fn of triggers as nodejs.NodejsFunction[]) {
      NagSuppressions.addResourceSuppressions(
        [fn, fn.role as iam.IRole],
        [
          { id: "AwsSolutions-IAM4", reason: "AWSLambdaBasicExecutionRole is the standard managed policy for CloudWatch Logs.", appliesTo: ["Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"] },
          { id: "AwsSolutions-IAM5", reason: "Table grants include index ARNs; no indexes exist but the CDK grant always adds the wildcard." },
          { id: "AwsSolutions-L1", reason: "Node.js 22 is the runtime required by the project spec and is a supported LTS release." },
        ],
        true,
      );
    }
  }
}
