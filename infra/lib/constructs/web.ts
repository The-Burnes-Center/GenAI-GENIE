import * as fs from "node:fs";
import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as deploy from "aws-cdk-lib/aws-s3-deployment";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { resourceName, stackName, type Environment } from "../../config";

const WEB_DIST = path.resolve(__dirname, "..", "..", "..", "web", "dist");

// Rewrite extensionless paths to the SPA shell. Done at the edge on the default behavior only, so
// API 404s from the /api/* behaviors are never rewritten to HTML (unlike distribution-wide errorResponses).
const SPA_REWRITE = `function handler(event) {
  var request = event.request;
  var last = request.uri.split('/').pop();
  if (last.indexOf('.') === -1) request.uri = '/index.html';
  return request;
}`;

export interface WebProps {
  environment: Environment;
  isProd: boolean;
  apiUrl: lambda.FunctionUrl;
  chatUrl: lambda.FunctionUrl;
  domainName?: string;
  certificateArn?: string;
}

export interface WebsiteConfig {
  region: string;
  userPoolId: string;
  userPoolClientId: string;
  passkeys: boolean;
  emailOtp: boolean;
  signupEnabled: boolean;
}

/** Website bucket (OAC) and a CloudFront distribution in front of the site and both Function URLs. */
export class Web extends Construct {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WebProps) {
    super(scope, id);
    const name = (part: string) => resourceName(props.environment, part);
    this.bucket = new s3.Bucket(this, "WebsiteBucket", {
      bucketName: `${name("web")}-${cdk.Aws.ACCOUNT_ID}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: props.isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !props.isProd,
    });

    // Same settings as the managed CachingDisabled / AllViewerExceptHostHeader policies, but named.
    const noCache = new cloudfront.CachePolicy(this, "ApiNoCache", {
      cachePolicyName: name("api-no-cache"),
      minTtl: cdk.Duration.seconds(0),
      defaultTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(0),
    });
    const forwardAll = new cloudfront.CfnOriginRequestPolicy(this, "ApiForward", {
      originRequestPolicyConfig: {
        name: name("api-forward"),
        headersConfig: { headerBehavior: "allExcept", headers: ["host"] },
        cookiesConfig: { cookieBehavior: "all" },
        queryStringsConfig: { queryStringBehavior: "all" },
      },
    });
    const forwardPolicy = cloudfront.OriginRequestPolicy.fromOriginRequestPolicyId(this, "ApiForwardRef", forwardAll.attrId);

    const apiBehavior = (origin: cloudfront.IOrigin, compress: boolean): cloudfront.BehaviorOptions => ({
      origin,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: noCache,
      originRequestPolicy: forwardPolicy,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      compress,
    });

    const spaRewrite = new cloudfront.Function(this, "SpaRewrite", {
      functionName: name("spa-rewrite"),
      code: cloudfront.FunctionCode.fromInline(SPA_REWRITE),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    const hasDomain = Boolean(props.domainName && props.certificateArn);
    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: stackName(props.environment),
      defaultRootObject: "index.html",
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      ...(hasDomain
        ? {
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            domainNames: [props.domainName as string],
            certificate: acm.Certificate.fromCertificateArn(this, "Certificate", props.certificateArn as string),
          }
        : {}),
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket, {
          originAccessControl: new cloudfront.S3OriginAccessControl(this, "WebOac", { originAccessControlName: name("web-oac") }),
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [{ function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors: {
        // Chat streams for minutes: long origin timeouts, and no compression so chunks are not buffered.
        "/api/chat*": apiBehavior(
          new origins.FunctionUrlOrigin(props.chatUrl, { readTimeout: cdk.Duration.seconds(60), keepaliveTimeout: cdk.Duration.seconds(60) }),
          false,
        ),
        "/api/*": apiBehavior(new origins.FunctionUrlOrigin(props.apiUrl), true),
      },
    });

    NagSuppressions.addResourceSuppressions(this.bucket, [
      { id: "AwsSolutions-S1", reason: "Demo-scale static site bucket: access logging adds cost with little value; CloudFront is the only reader." },
    ]);
    NagSuppressions.addResourceSuppressions(this.distribution, [
      { id: "AwsSolutions-CFR1", reason: "Internal workspace for invited or self-registered users worldwide; geo restriction is not a requirement." },
      { id: "AwsSolutions-CFR2", reason: "WAF adds a fixed monthly cost that defeats the near-zero idle cost goal. Every API call needs a verified Cognito token and the daily limit bounds usage." },
      { id: "AwsSolutions-CFR3", reason: "Access logging is off to keep idle cost near zero; Lambda logs carry request details." },
      { id: "AwsSolutions-CFR4", reason: "With the default *.cloudfront.net certificate CloudFront forces TLSv1; the TLS 1.2 minimum is applied automatically when a custom domain and certificate are configured." },
    ]);
  }

  /** Publish the built site plus a generated config.json. Call after the auth resources exist. */
  deploySite(config: WebsiteConfig): void {
    const skip = process.env.GENIE_SKIP_WEB === "1";
    const hasBuild = fs.existsSync(path.join(WEB_DIST, "index.html"));
    if (!hasBuild && !skip) {
      throw new Error(
        `web/dist/index.html not found. Build the site first (npm run build:web) or set GENIE_SKIP_WEB=1 to deploy a placeholder page.`,
      );
    }
    const siteSource = hasBuild
      ? deploy.Source.asset(WEB_DIST)
      : deploy.Source.data("index.html", "<!doctype html><title>Genie</title><p>Genie web app not built yet.</p>");

    new deploy.BucketDeployment(this, "DeploySite", {
      sources: [siteSource, deploy.Source.jsonData("config.json", config)],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ["/*"],
      memoryLimit: 512,
    });
    // The handler Lambda and its role are a singleton at stack level, not under DeploySite.
    for (const child of cdk.Stack.of(this).node.children) {
      if (!child.node.id.startsWith("Custom::CDKBucketDeployment")) continue;
      NagSuppressions.addResourceSuppressions(
        child,
        [
          { id: "AwsSolutions-L1", reason: "The BucketDeployment handler runtime is managed by aws-cdk-lib." },
          { id: "AwsSolutions-IAM4", reason: "Managed policy attached by the aws-cdk-lib BucketDeployment handler." },
          { id: "AwsSolutions-IAM5", reason: "BucketDeployment must read its CDK asset bucket and write any key in the website bucket; CloudFront invalidation has no resource scoping." },
        ],
        true,
      );
    }
  }
}
