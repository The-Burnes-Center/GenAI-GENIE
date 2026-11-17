#!/usr/bin/env node
import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { loadConfig, stackName } from "../config";
import { GenieStack } from "../lib/genie-stack";

// NodejsFunction runs `npx --no-install esbuild` inside backend/, which has no esbuild of its own.
// Put infra/node_modules/.bin on PATH so the infra copy is found.
process.env.PATH = `${path.join(__dirname, "..", "node_modules", ".bin")}${path.delimiter}${process.env.PATH ?? ""}`;

const config = loadConfig();
const app = new cdk.App();

new GenieStack(app, stackName(config.environment), {
  stackName: stackName(config.environment),
  config,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  description: "Genie v2: private multi-model AI workspace",
});

cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
