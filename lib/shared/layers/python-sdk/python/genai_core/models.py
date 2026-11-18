import genai_core.types
import genai_core.clients
import genai_core.parameters

from genai_core.types import Modality, Provider, ModelInterface


def _bedrock_model(model_id, name, input_modalities):
    return {
        "provider": Provider.BEDROCK.value,
        "modelId": model_id,
        "name": name,
        "streaming": True,
        "inputModalities": input_modalities,
        "outputModalities": [Modality.TEXT.value],
        "interface": ModelInterface.LANGCHIAN.value,
        "ragSupported": True,
    }


# Bedrock models offered in the UI. Every entry is called through the Converse
# API by the langchain adapter. The UI matches models by name, so names must be unique.
TEXT = [Modality.TEXT.value]
TEXT_AND_IMAGE = [Modality.TEXT.value, Modality.IMAGE.value]

CURATED_BEDROCK_MODELS = [
    _bedrock_model("us.anthropic.claude-haiku-5-5", "Claude Haiku 5.5", TEXT_AND_IMAGE),
    _bedrock_model("us.anthropic.claude-sonnet-5-5", "Claude Sonnet 5.5", TEXT_AND_IMAGE),
    _bedrock_model("us.anthropic.claude-opus-5-5", "Claude Opus 5.5", TEXT_AND_IMAGE),
    _bedrock_model("us.amazon.nova-2-lite-v1:0", "Nova 2 Lite", TEXT_AND_IMAGE),
    _bedrock_model("us.amazon.nova-pro-v1:0", "Nova Pro", TEXT_AND_IMAGE),
    _bedrock_model("us.meta.llama4-maverick-17b-instruct-v1:0", "Llama 4 Maverick", TEXT),
    _bedrock_model("mistral.mistral-large-3-675b-instruct", "Mistral Large 3", TEXT),
    _bedrock_model("openai.gpt-oss-120b-1:0", "gpt-oss 120B", TEXT),
    _bedrock_model("deepseek.v3.2", "DeepSeek V3.2", TEXT),
    _bedrock_model("qwen.qwen3-next-80b-a3b", "Qwen3 Next 80B", TEXT),
    _bedrock_model("global.openai.gpt-6.2-sol", "GPT-6.2 Sol", TEXT),
    _bedrock_model("global.xai.grok-4.7", "Grok 4.7", TEXT),
]


# Original list_models function with slight modifications
def list_models():
    models = []

    models.extend(dict(model) for model in CURATED_BEDROCK_MODELS)

    # Adding a meta model directly as a dictionary
    meta_model = {
        "modelArn": "as_db_supersecret_arn",
        "provider": Provider.BEDROCK.value,
        "modelId": "meta_model_as_db_supersecret_id",
        "name": "Smart Model",
        "streaming": True,
        "inputModalities": [Modality.TEXT.value],
        "outputModalities": [Modality.TEXT.value],
        "interface": ModelInterface.LANGCHIAN.value,
        "ragSupported": True,
    }
    models.append(meta_model)

    return models
