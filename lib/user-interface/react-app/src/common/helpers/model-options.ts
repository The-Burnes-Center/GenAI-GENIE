import { SelectProps } from "@cloudscape-design/components";

export const SMART_MODEL_NAME = "Smart Model";

// One line per model, in words a first-time user can act on
const MODEL_DESCRIPTIONS: Record<string, string> = {
  [SMART_MODEL_NAME]: "Picks a good model for each question. Recommended.",
  "Claude Haiku 5.5": "Fast and low cost",
  "Claude Sonnet 5.5": "Strong all-rounder for harder work",
  "Claude Opus 5.5": "Most capable, for the hardest problems",
  "Nova 2 Lite": "Fast and low cost, by Amazon",
  "Nova Pro": "Amazon's more capable model",
  "Llama 4 Maverick": "Open model by Meta",
  "Mistral Large 3": "Mistral AI's largest model",
  "gpt-oss 120B": "Open model by OpenAI",
  "DeepSeek V3.2": "Open model by DeepSeek",
  "Qwen3 Next 80B": "Open model by Qwen",
  "GPT-6.2 Sol": "OpenAI's frontier model",
  "Grok 4.7": "xAI's model",
};

const toOption = (model: { provider: string; name: string }): SelectProps.Option => ({
  label: model.name,
  value: `${model.provider}::${model.name}`,
  description: MODEL_DESCRIPTIONS[model.name],
});

// Smart Model first as the recommendation, then every other model in the order the API lists them
// (the curated order: Claude, Nova, then the rest). Values keep the provider::name format the chat uses.
export function getChatModelOptions(
  models: { provider: string; name: string }[]
): SelectProps.OptionGroup[] {
  const smart = models.filter((m) => m.name === SMART_MODEL_NAME);
  const others = models.filter((m) => m.name !== SMART_MODEL_NAME);
  const groups: SelectProps.OptionGroup[] = [];
  if (smart.length) groups.push({ label: "Recommended", options: smart.map(toOption) });
  if (others.length) groups.push({ label: "Choose a model", options: others.map(toOption) });
  return groups;
}
