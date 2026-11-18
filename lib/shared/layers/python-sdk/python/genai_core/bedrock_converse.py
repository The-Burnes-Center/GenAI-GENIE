"""Shared rules for calling Bedrock models through the Converse API.

Converse gives every provider the same request and response shape. These
helpers hold the per-model rules so the LangChain adapter and the idefics
image adapter stay in sync.
"""

MIN_OUTPUT_TOKENS = 2048
MAX_OUTPUT_TOKENS = 8192

# Claude 5.x rejects sampling parameters and thinks by default. Adaptive
# thinking at low effort is the only thinking setting every Claude 5.x model
# accepts (Opus 5.5 rejects "disabled", Sonnet 5.5 rejects it too).
CLAUDE_REQUEST_FIELDS = {
    "thinking": {"type": "adaptive"},
    "output_config": {"effort": "low"},
}


# Models that reject temperature and topP with a ValidationException (checked live):
# Claude 5.x, GPT-6.x and Grok 4.x. gpt-oss, Nova, Llama, Mistral, DeepSeek and Qwen accept them.
NO_SAMPLING_PARAMS_MARKERS = ("anthropic.claude", "openai.gpt-6", "xai.grok")


def is_claude_model(model_id: str) -> bool:
    return "anthropic.claude" in model_id


def accepts_sampling_params(model_id: str) -> bool:
    return not any(marker in model_id for marker in NO_SAMPLING_PARAMS_MARKERS)


def build_converse_request(
    model_id: str,
    max_tokens=None,
    temperature=None,
    top_p=None,
    stop_sequences=None,
) -> dict:
    """Return the extra keyword arguments for converse / converse_stream."""
    output_tokens = int(max_tokens or MIN_OUTPUT_TOKENS)
    output_tokens = min(max(output_tokens, MIN_OUTPUT_TOKENS), MAX_OUTPUT_TOKENS)

    inference_config = {"maxTokens": output_tokens}
    request = {"inferenceConfig": inference_config}

    if stop_sequences:
        inference_config["stopSequences"] = list(stop_sequences)

    if accepts_sampling_params(model_id):
        if temperature is not None:
            inference_config["temperature"] = float(temperature)
        if top_p is not None:
            inference_config["topP"] = float(top_p)

    if is_claude_model(model_id):
        request["additionalModelRequestFields"] = dict(CLAUDE_REQUEST_FIELDS)

    return request


def get_text(content_blocks: list) -> str:
    """Join the text blocks of a Converse message, skipping reasoning and other blocks."""
    return "".join(block["text"] for block in content_blocks if "text" in block)


def get_stream_text(event: dict) -> str:
    """Return the text delta of a converse_stream event, or an empty string."""
    return event.get("contentBlockDelta", {}).get("delta", {}).get("text", "")
