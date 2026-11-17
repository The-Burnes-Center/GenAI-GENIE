import { ListFoundationModelsCommand, ListInferenceProfilesCommand } from "@aws-sdk/client-bedrock";
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrock, bedrockRuntime } from "./aws.js";
import type { AvailableModel, ModelTestResponse } from "./api-types.js";
import type { ModelEntry } from "./types.js";

/**
 * Bedrock models and inference profiles that could be added to the catalog:
 * ACTIVE text-output foundation models plus inference profiles, minus anything already listed.
 */
export async function listAvailableModels(catalog: ModelEntry[]): Promise<AvailableModel[]> {
  const known = new Set(catalog.map((m) => m.modelId));
  const found = new Map<string, AvailableModel>();

  const models = await bedrock().send(new ListFoundationModelsCommand({ byOutputModality: "TEXT" }));
  for (const m of models.modelSummaries ?? []) {
    if (!m.modelId || m.modelLifecycle?.status !== "ACTIVE") continue;
    found.set(m.modelId, { modelId: m.modelId, label: m.modelName ?? m.modelId, provider: m.providerName ?? "", kind: "model" });
  }

  let nextToken: string | undefined;
  do {
    const page = await bedrock().send(new ListInferenceProfilesCommand({ maxResults: 100, nextToken }));
    for (const p of page.inferenceProfileSummaries ?? []) {
      if (!p.inferenceProfileId || p.status !== "ACTIVE") continue;
      found.set(p.inferenceProfileId, {
        modelId: p.inferenceProfileId,
        label: p.inferenceProfileName ?? p.inferenceProfileId,
        provider: "",
        kind: "profile",
      });
    }
    nextToken = page.nextToken;
  } while (nextToken);

  return [...found.values()].filter((m) => !known.has(m.modelId)).sort((a, b) => a.modelId.localeCompare(b.modelId));
}

/** One tiny Converse call so an admin can confirm a catalog entry works. */
export async function testModel(modelId: string): Promise<ModelTestResponse> {
  const started = Date.now();
  try {
    await bedrockRuntime().send(
      new ConverseCommand({
        modelId,
        messages: [{ role: "user", content: [{ text: "Reply with the single word OK." }] }],
        inferenceConfig: { maxTokens: 64 },
      }),
    );
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - started, error: `${(err as Error).name}: ${(err as Error).message}`.slice(0, 300) };
  }
}
