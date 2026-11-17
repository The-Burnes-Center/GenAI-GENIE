import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Annotations, Match, Template } from "aws-cdk-lib/assertions";
import { AwsSolutionsChecks } from "cdk-nag";
import { beforeAll, describe, expect, it } from "vitest";
import { loadConfig, resourceName, stackName, type Environment } from "../config";
import { GenieStack } from "../lib/genie-stack";

type Resource = { Type: string; Properties?: Record<string, any> };

function synth(environment: Environment) {
  process.env.GENIE_SKIP_WEB = "1";
  // Skip esbuild bundling: the test only needs the template.
  const app = new cdk.App({ context: { "aws:cdk:bundling-stacks": [] } });
  const stack = new GenieStack(app, stackName(environment), {
    stackName: stackName(environment),
    config: { environment },
    env: { account: "123456789012", region: "us-east-1" },
  });
  cdk.Aspects.of(app).add(new AwsSolutionsChecks());
  const template = Template.fromStack(stack);
  return { stack, template, resources: template.toJSON().Resources as Record<string, Resource> };
}

const EXPECTED_TAGS = (env: string) => ({ Project: "genai-genie", Environment: env, ManagedBy: "cdk", Owner: "burnes-center" });

/** Normalize the two tag shapes CloudFormation uses here: [{Key,Value}] and a plain map. */
function tagsOf(r: Resource): Record<string, string> | undefined {
  const p = r.Properties ?? {};
  const raw = p.Tags ?? p.UserPoolTags;
  if (!raw) return undefined;
  if (Array.isArray(raw)) return Object.fromEntries(raw.map((t: { Key: string; Value: string }) => [t.Key, t.Value]));
  return raw;
}

// Property that holds the physical name, per type. Values may be a string or an Fn::Join that starts with a literal.
const NAME_PROPERTY: Record<string, (p: Record<string, any>) => unknown> = {
  "AWS::Cognito::UserPool": (p) => p.UserPoolName,
  "AWS::Cognito::UserPoolClient": (p) => p.ClientName,
  "AWS::DynamoDB::Table": (p) => p.TableName,
  "AWS::S3::Bucket": (p) => p.BucketName,
  "AWS::S3Vectors::VectorBucket": (p) => p.VectorBucketName,
  "AWS::S3Vectors::Index": (p) => p.IndexName,
  "AWS::Bedrock::KnowledgeBase": (p) => p.Name,
  "AWS::Bedrock::DataSource": (p) => p.Name,
  "AWS::IAM::Role": (p) => p.RoleName,
  "AWS::Lambda::Function": (p) => p.FunctionName,
  "AWS::Lambda::LayerVersion": (p) => p.LayerName,
  "AWS::Logs::LogGroup": (p) => p.LogGroupName,
  "AWS::CloudFront::Distribution": (p) => p.DistributionConfig?.Comment,
  "AWS::CloudFront::Function": (p) => p.Name,
  "AWS::CloudFront::OriginAccessControl": (p) => p.OriginAccessControlConfig?.Name,
  "AWS::CloudFront::CachePolicy": (p) => p.CachePolicyConfig?.Name,
  "AWS::CloudFront::OriginRequestPolicy": (p) => p.OriginRequestPolicyConfig?.Name,
  "AWS::SSM::Parameter": (p) => p.Name,
};

/** Resource types that carry no tags, and why each is exempt from the tag check. */
const TAG_EXEMPT: Record<string, string> = {
  "AWS::Bedrock::DataSource": "CloudFormation type has no Tags property",
  "AWS::CDK::Metadata": "CDK bookkeeping, not an AWS resource",
  "AWS::CloudFront::CachePolicy": "no Tags property",
  "AWS::CloudFront::OriginAccessControl": "no Tags property",
  "AWS::CloudFront::OriginRequestPolicy": "no Tags property",
  "AWS::Cognito::UserPoolClient": "no Tags property (the pool carries UserPoolTags)",
  "AWS::Cognito::UserPoolGroup": "no Tags property",
  "AWS::IAM::Policy": "inline policy attached to a tagged role; no Tags property",
  "AWS::Lambda::LayerVersion": "layer versions cannot be tagged",
  "AWS::Lambda::Permission": "no Tags property",
  "AWS::Lambda::Url": "no Tags property (the function carries them)",
  "AWS::S3::BucketPolicy": "no Tags property",
  "Custom::CDKBucketDeployment": "custom resource invocation, not an AWS resource",
  "Custom::S3AutoDeleteObjects": "custom resource invocation, not an AWS resource",
};

/** Names that are intentionally not `genie-{env}-...`. */
const NAME_EXEMPT_VALUES = new Set(["admin"]); // the Cognito group, fixed by the spec and the Lambda code

function literalName(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  const join = (value as { "Fn::Join"?: [string, unknown[]] } | undefined)?.["Fn::Join"];
  if (join && typeof join[1][0] === "string") return join[1][0];
  return undefined;
}

describe.each(["dev", "prod"] as const)("naming and tagging (%s)", (env) => {
  let resources: Record<string, Resource>;
  let template: Template;
  let stack: cdk.Stack;
  beforeAll(() => {
    ({ resources, template, stack } = synth(env));
  });

  it("names the stack genie-{env}", () => {
    expect(stack.stackName).toBe(`genie-${env}`);
  });

  it("every resource with a name property uses genie-{env}-... (or the SSM / log group path forms)", () => {
    const pattern = new RegExp(`^(genie-${env}(-|$)|/genie/${env}/|/aws/lambda/genie-${env}-)`);
    const bad: string[] = [];
    let checked = 0;
    for (const [id, r] of Object.entries(resources)) {
      const read = NAME_PROPERTY[r.Type];
      if (!read) continue;
      const name = literalName(read(r.Properties ?? {}));
      if (name !== undefined && NAME_EXEMPT_VALUES.has(name)) continue;
      checked++;
      if (!name || !pattern.test(name)) bad.push(`${r.Type} ${id}: ${JSON.stringify(read(r.Properties ?? {}))}`);
    }
    expect(bad).toEqual([]);
    expect(checked).toBeGreaterThanOrEqual(30);
  });

  it("no auto-generated physical names: every type in the name table is named explicitly", () => {
    for (const [id, r] of Object.entries(resources)) {
      const read = NAME_PROPERTY[r.Type];
      if (read) expect(read(r.Properties ?? {}), `${r.Type} ${id}`).toBeTruthy();
    }
  });

  it("matches the documented names for the main resources", () => {
    template.hasResourceProperties("AWS::Cognito::UserPool", { UserPoolName: `genie-${env}-users` });
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", { ClientName: `genie-${env}-web` });
    template.hasResourceProperties("AWS::Cognito::UserPoolGroup", { GroupName: "admin" });
    template.hasResourceProperties("AWS::DynamoDB::Table", { TableName: `genie-${env}-data` });
    for (const fn of ["api", "chat", "pre-signup", "post-confirmation"]) {
      template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: `genie-${env}-${fn}` });
      template.hasResourceProperties("AWS::IAM::Role", { RoleName: `genie-${env}-${fn}-role` });
      template.hasResourceProperties("AWS::Logs::LogGroup", { LogGroupName: `/aws/lambda/genie-${env}-${fn}`, RetentionInDays: 30 });
    }
    template.hasResourceProperties("AWS::S3::Bucket", { BucketName: { "Fn::Join": ["", [`genie-${env}-uploads-`, { Ref: "AWS::AccountId" }]] } });
    template.hasResourceProperties("AWS::S3::Bucket", { BucketName: { "Fn::Join": ["", [`genie-${env}-web-`, { Ref: "AWS::AccountId" }]] } });
    template.hasResourceProperties("AWS::S3Vectors::Index", { IndexName: `genie-${env}-documents` });
    template.hasResourceProperties("AWS::Bedrock::KnowledgeBase", { Name: `genie-${env}-documents` });
    template.hasResourceProperties("AWS::Bedrock::DataSource", { Name: `genie-${env}-workspaces` });
    template.hasResourceProperties("AWS::IAM::Role", { RoleName: `genie-${env}-kb-role` });
    template.hasResourceProperties("AWS::SSM::Parameter", { Name: `/genie/${env}/auth` });
    template.hasResourceProperties("AWS::CloudFront::Function", { Name: `genie-${env}-spa-rewrite` });
    template.hasResourceProperties("AWS::CloudFront::OriginAccessControl", { OriginAccessControlConfig: Match.objectLike({ Name: `genie-${env}-web-oac` }) });
    template.hasResourceProperties("AWS::CloudFront::CachePolicy", { CachePolicyConfig: Match.objectLike({ Name: `genie-${env}-api-no-cache` }) });
    template.hasResourceProperties("AWS::CloudFront::OriginRequestPolicy", { OriginRequestPolicyConfig: Match.objectLike({ Name: `genie-${env}-api-forward` }) });
    template.hasResourceProperties("AWS::CloudFront::Distribution", { DistributionConfig: Match.objectLike({ Comment: `genie-${env}` }) });
  });

  it("the data table expires tombstones through the expiresAt TTL attribute", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", { TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true } });
  });

  it("log groups are explicit, 30 days, and deleted with the stack", () => {
    const raw = template.toJSON().Resources as Record<string, { Type: string; DeletionPolicy?: string; Properties?: { RetentionInDays?: number } }>;
    const groups = Object.values(raw).filter((r) => r.Type === "AWS::Logs::LogGroup");
    expect(groups).toHaveLength(4);
    for (const g of groups) {
      expect(g.Properties?.RetentionInDays).toBe(30);
      expect(g.DeletionPolicy).toBe("Delete");
    }
  });

  it("every taggable resource carries Project, Environment, ManagedBy and Owner", () => {
    const expected = EXPECTED_TAGS(env);
    const taggableTypes = new Set(Object.values(resources).filter((r) => tagsOf(r)).map((r) => r.Type));
    // Guard against a type silently losing tags: these must be tagged.
    for (const must of [
      "AWS::Cognito::UserPool", "AWS::DynamoDB::Table", "AWS::S3::Bucket", "AWS::S3Vectors::VectorBucket", "AWS::S3Vectors::Index",
      "AWS::Bedrock::KnowledgeBase", "AWS::Lambda::Function", "AWS::IAM::Role", "AWS::Logs::LogGroup", "AWS::CloudFront::Distribution",
      "AWS::CloudFront::Function", "AWS::SSM::Parameter",
    ]) expect(taggableTypes.has(must), `${must} should be tagged`).toBe(true);

    const missing: string[] = [];
    for (const [id, r] of Object.entries(resources)) {
      if (TAG_EXEMPT[r.Type]) continue;
      const tags = tagsOf(r);
      if (!tags || Object.entries(expected).some(([k, v]) => tags[k] !== v)) missing.push(`${r.Type} ${id}: ${JSON.stringify(tags)}`);
    }
    expect(missing).toEqual([]);
  });

  it("every exemption is for a type that really has no tags in the template", () => {
    for (const r of Object.values(resources)) {
      if (TAG_EXEMPT[r.Type]) expect(tagsOf(r), r.Type).toBeUndefined();
    }
  });

  it("cdk-nag reports no unsuppressed errors", () => {
    expect(Annotations.fromStack(stack).findError("*", Match.stringLikeRegexp("AwsSolutions-.*"))).toEqual([]);
  });
});

describe("config loading", () => {
  const write = (body: unknown) => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "genie-cfg-")), "config.json");
    fs.writeFileSync(file, JSON.stringify(body));
    return file;
  };

  it("defaults to dev when there is no file, and has no prefix", () => {
    const cfg = loadConfig(path.join(os.tmpdir(), "does-not-exist.json"));
    expect(cfg).toEqual({ environment: "dev" });
    expect(cfg).not.toHaveProperty("prefix");
  });

  it("accepts dev and prod and rejects anything else", () => {
    expect(loadConfig(write({ environment: "prod" })).environment).toBe("prod");
    expect(() => loadConfig(write({ environment: "staging" }))).toThrow(/dev.*prod/);
  });

  it("derives names from the environment only", () => {
    expect(stackName("prod")).toBe("genie-prod");
    expect(resourceName("dev", "data")).toBe("genie-dev-data");
  });

  it("still validates the optional fields", () => {
    expect(() => loadConfig(write({ domainName: "a.example.org" }))).toThrow(/together/);
    expect(() => loadConfig(write({ sesFromEmail: "a@b.org" }))).toThrow(/together/);
    expect(() => loadConfig(write({ chatReservedConcurrency: 0 }))).toThrow(/positive integer/);
    expect(loadConfig(write({ chatReservedConcurrency: null })).chatReservedConcurrency).toBeNull();
  });
});
