import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { DEFAULT_API_CONCURRENCY, DEFAULT_CHAT_CONCURRENCY, emailOtpEnabled, reservedConcurrency, type GenieConfig } from "../config";
import { CustomResourceNaming, tagsFor } from "./custom-resources";
import { Api } from "./constructs/api";
import { Auth } from "./constructs/auth";
import { Data } from "./constructs/data";
import { Knowledge } from "./constructs/knowledge";
import { Web } from "./constructs/web";

export interface GenieStackProps extends cdk.StackProps {
  config: GenieConfig;
}

/**
 * Wiring order avoids a cycle: data -> knowledge -> api -> web (distribution) -> auth.
 * The pool needs the distribution domain (passkey RP ID) and the distribution needs the Function URLs,
 * so the Lambdas never reference the pool: they read it from an SSM parameter by name.
 */
export class GenieStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GenieStackProps) {
    super(scope, id, props);
    const { config } = props;
    for (const [key, value] of Object.entries(tagsFor(config.environment))) cdk.Tags.of(this).add(key, value);
    cdk.Aspects.of(this).add(new CustomResourceNaming(config.environment));

    const data = new Data(this, "Data", { environment: config.environment, isProd: config.environment === "prod" });
    const knowledge = new Knowledge(this, "Knowledge", { environment: config.environment, uploadsBucket: data.uploadsBucket });
    const api = new Api(this, "Api", {
      environment: config.environment,
      table: data.table,
      uploadsBucket: data.uploadsBucket,
      knowledgeBaseArn: knowledge.knowledgeBaseArn,
      knowledgeBaseId: knowledge.knowledgeBase.attrKnowledgeBaseId,
      dataSourceId: knowledge.dataSource.attrDataSourceId,
      emailOtp: emailOtpEnabled(config),
      chatReservedConcurrency: reservedConcurrency(config.chatReservedConcurrency, DEFAULT_CHAT_CONCURRENCY),
      apiReservedConcurrency: reservedConcurrency(config.apiReservedConcurrency, DEFAULT_API_CONCURRENCY),
    });
    const web = new Web(this, "Web", {
      environment: config.environment,
      isProd: config.environment === "prod",
      apiUrl: api.apiUrl,
      chatUrl: api.chatUrl,
      domainName: config.domainName,
      certificateArn: config.certificateArn,
    });
    const siteDomain = config.domainName ?? web.distribution.distributionDomainName;
    const auth = new Auth(this, "Auth", {
      config,
      table: data.table,
      relyingPartyId: siteDomain,
      authParameterName: api.authParameterName,
    });

    web.deploySite({
      region: this.region,
      userPoolId: auth.userPool.userPoolId,
      userPoolClientId: auth.client.userPoolClientId,
      passkeys: true,
      emailOtp: emailOtpEnabled(config),
      signupEnabled: true,
    });

    new cdk.CfnOutput(this, "SiteUrl", { value: `https://${siteDomain}` });
    new cdk.CfnOutput(this, "UserPoolId", { value: auth.userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: auth.client.userPoolClientId });
    new cdk.CfnOutput(this, "TableName", { value: data.table.tableName });
    new cdk.CfnOutput(this, "UploadsBucket", { value: data.uploadsBucket.bucketName });
    new cdk.CfnOutput(this, "KnowledgeBaseId", { value: knowledge.knowledgeBase.attrKnowledgeBaseId });
  }
}
