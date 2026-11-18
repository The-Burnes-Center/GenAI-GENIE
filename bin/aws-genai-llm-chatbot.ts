#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { AwsGenAILLMChatbotStack } from "../lib/aws-genai-llm-chatbot-stack";
import { AwsSolutionsChecks } from "cdk-nag";
import { getConfig } from "./config";
import { Aspects, Tags } from "aws-cdk-lib";

const app = new cdk.App();

const config = getConfig();

new AwsGenAILLMChatbotStack(app, `${config.prefix}GenAIChatBotStack`, {
  config,
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});

// Cost allocation tags applied to every resource in the stack
const tags: Record<string, string> = {
  Project: "genai-genie",
  Environment: config.environment ?? "dev",
  ManagedBy: "cdk",
  Owner: "burnes-center",
};
Object.entries(tags).forEach(([key, value]) => Tags.of(app).add(key, value));

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
