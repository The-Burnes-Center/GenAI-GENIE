import json
import os

import boto3

from .base import MultiModalModelBase
from genai_core.types import ChatbotMessageType
from genai_core.clients import get_bedrock_client
from genai_core.bedrock_converse import build_converse_request, get_text
from genai_core.registry import registry

IMAGE_FORMATS = {"png": "png", "jpeg": "jpeg", "jpg": "jpeg", "gif": "gif", "webp": "webp"}
DEFAULT_IMAGE_FORMAT = "jpeg"


def get_image_format(key: str) -> str:
    extension = key.rsplit(".", 1)[-1].lower() if "." in key else ""
    return IMAGE_FORMATS.get(extension, DEFAULT_IMAGE_FORMAT)


def get_image_bytes(key: str) -> bytes:
    s3 = boto3.client("s3")
    response = s3.get_object(
        Bucket=os.environ["CHATBOT_FILES_BUCKET_NAME"], Key=f"public/{key}"
    )
    return response["Body"].read()


def get_image_block(file: dict) -> dict:
    # Only the key is stored in the prompt so it stays JSON-safe and small for chat history
    key = file["key"]
    return {"image": {"key": key, "format": get_image_format(key)}}


def add_turn(turns: list, role: str, content: list):
    """Append content to the turns, merging consecutive turns of the same role.

    Converse requires alternating roles that start with a user turn, and blank text blocks
    are rejected, so both are handled here.
    """
    content = [block for block in content if "image" in block or block["text"].strip()]
    if not content:
        return
    if not turns and role != "user":
        return
    if turns and turns[-1]["role"] == role:
        turns[-1]["content"].extend(content)
    else:
        turns.append({"role": role, "content": content})


class ConverseMultiModal(MultiModalModelBase):
    """Multimodal chat through the Converse API for Claude and Nova models."""

    model_id: str
    client: any

    def __init__(self, model_id: str):
        self.model_id = model_id
        self.client = get_bedrock_client()

    def format_prompt(self, prompt: str, messages: list, files: list) -> str:
        turns = []

        # Chat history
        for message in messages:
            if message.type.lower() == ChatbotMessageType.Human.value.lower():
                message_files = message.additional_kwargs.get("files", [])
                content = [{"text": message.content}]
                content += [get_image_block(f) for f in message_files]
                add_turn(turns, "user", content)
            if message.type.lower() == ChatbotMessageType.AI.value.lower():
                add_turn(turns, "assistant", [{"text": message.content}])

        # User prompt
        content = [{"text": prompt}] + [get_image_block(f) for f in files]
        add_turn(turns, "user", content)

        return json.dumps({"messages": turns})

    def to_converse_block(self, block: dict) -> dict:
        if "image" not in block:
            return block
        key = block["image"]["key"]
        return {
            "image": {
                "format": block["image"]["format"],
                "source": {"bytes": get_image_bytes(key)},
            }
        }

    def handle_run(self, prompt: str, model_kwargs: dict) -> str:
        print(model_kwargs)
        messages = [
            {
                "role": turn["role"],
                "content": [self.to_converse_block(block) for block in turn["content"]],
            }
            for turn in json.loads(prompt)["messages"]
        ]

        request = build_converse_request(
            self.model_id,
            max_tokens=model_kwargs.get("maxTokens"),
            temperature=model_kwargs.get("temperature"),
            top_p=model_kwargs.get("topP"),
        )
        response = self.client.converse(
            modelId=self.model_id, messages=messages, **request
        )

        return get_text(response["output"]["message"]["content"])


registry.register(
    r"^bedrock\.((us|global)\.)?(anthropic\.claude|amazon\.nova)", ConverseMultiModal
)
