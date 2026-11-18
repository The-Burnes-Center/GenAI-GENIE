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
# Input modalities were checked live: a model gets DOCUMENT only if it accepts a
# Converse document block (PDF and TXT). Mistral, gpt-oss, DeepSeek, Qwen, GPT-6.2 and Grok
# returned "This model doesn't support documents".
TEXT = [Modality.TEXT.value]
TEXT_AND_IMAGE = [Modality.TEXT.value, Modality.IMAGE.value]
TEXT_AND_DOCUMENT = [Modality.TEXT.value, Modality.DOCUMENT.value]
TEXT_IMAGE_AND_DOCUMENT = [
    Modality.TEXT.value,
    Modality.IMAGE.value,
    Modality.DOCUMENT.value,
]

CURATED_BEDROCK_MODELS = [
    _bedrock_model("us.anthropic.claude-haiku-5-5", "Claude Haiku 5.5", TEXT_IMAGE_AND_DOCUMENT),
    _bedrock_model("us.anthropic.claude-sonnet-5-5", "Claude Sonnet 5.5", TEXT_IMAGE_AND_DOCUMENT),
    _bedrock_model("us.anthropic.claude-opus-5-5", "Claude Opus 5.5", TEXT_IMAGE_AND_DOCUMENT),
    _bedrock_model("us.amazon.nova-2-lite-v1:0", "Nova 2 Lite", TEXT_IMAGE_AND_DOCUMENT),
    _bedrock_model("us.amazon.nova-pro-v1:0", "Nova Pro", TEXT_IMAGE_AND_DOCUMENT),
    _bedrock_model("us.meta.llama4-maverick-17b-instruct-v1:0", "Llama 4 Maverick", TEXT_AND_DOCUMENT),
    _bedrock_model("mistral.mistral-large-3-675b-instruct", "Mistral Large 3", TEXT),
    _bedrock_model("openai.gpt-oss-120b-1:0", "gpt-oss 120B", TEXT),
    _bedrock_model("deepseek.v3.2", "DeepSeek V3.2", TEXT),
    _bedrock_model("qwen.qwen3-next-80b-a3b", "Qwen3 Next 80B", TEXT),
    _bedrock_model("global.openai.gpt-6.2-sol", "GPT-6.2 Sol", TEXT),
    _bedrock_model("global.xai.grok-4.7", "Grok 4.7", TEXT),
]


def get_input_modalities(model_id: str) -> list:
    """Return the input modalities of a curated Bedrock model, or [] if it is unknown."""
    for model in CURATED_BEDROCK_MODELS:
        if model["modelId"] == model_id:
            return model["inputModalities"]
    return []


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
        # Documents are answered by Claude Haiku 5.5 (see the image request handler)
        "inputModalities": TEXT_AND_DOCUMENT,
        "outputModalities": [Modality.TEXT.value],
        "interface": ModelInterface.LANGCHIAN.value,
        "ragSupported": True,
    }
    models.append(meta_model)

    return models
