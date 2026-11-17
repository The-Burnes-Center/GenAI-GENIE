import { BedrockClient } from "@aws-sdk/client-bedrock";
import { BedrockAgentClient } from "@aws-sdk/client-bedrock-agent";
import { BedrockAgentRuntimeClient } from "@aws-sdk/client-bedrock-agent-runtime";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { S3Client } from "@aws-sdk/client-s3";

// Clients are created lazily so unit tests never need AWS configuration.
function lazy<T>(make: () => T): () => T {
  let instance: T | undefined;
  return () => (instance ??= make());
}

// Adaptive retry backs off on throttling; four attempts, then the error surfaces as BEDROCK_THROTTLED.
const retry = { retryMode: "adaptive", maxAttempts: 4 } as const;

export const bedrockRuntime = lazy(() => new BedrockRuntimeClient(retry));
export const bedrock = lazy(() => new BedrockClient(retry));
export const bedrockAgent = lazy(() => new BedrockAgentClient(retry));
export const bedrockAgentRuntime = lazy(() => new BedrockAgentRuntimeClient(retry));
export const cognito = lazy(() => new CognitoIdentityProviderClient({}));
export const s3 = lazy(() => new S3Client({}));
