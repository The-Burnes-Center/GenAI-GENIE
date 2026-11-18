import { Model } from "../../API";

// Model ids look like "us.anthropic.claude-..." or "mistral.mistral-large-...".
// The company is the id segment that matches one of these keys.
const PROVIDER_NAMES: Record<string, string> = {
  anthropic: "Anthropic",
  amazon: "Amazon",
  meta: "Meta",
  mistral: "Mistral AI",
  openai: "OpenAI",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  xai: "xAI",
};

const SMART_MODEL_NAME = "Smart Model";

const MODALITY_LABELS: Record<string, string> = {
  TEXT: "text",
  IMAGE: "images",
  DOCUMENT: "documents",
  VIDEO: "video",
  AUDIO: "audio",
};

export abstract class ModelDisplayHelper {
  static getProviderName(model: Pick<Model, "name" | "modelId">): string {
    if (model.name === SMART_MODEL_NAME) {
      return "Automatic";
    }

    const segments = (model.modelId ?? "").toLowerCase().split(".");
    const key = Object.keys(PROVIDER_NAMES).find((name) =>
      segments.includes(name)
    );

    return key ? PROVIDER_NAMES[key] : "Other";
  }

  static getCanRead(inputModalities: string[]): string {
    if (!inputModalities || inputModalities.length === 0) {
      return "Not listed";
    }

    const text = inputModalities
      .map((modality) => MODALITY_LABELS[modality] ?? modality.toLowerCase())
      .join(", ");

    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
