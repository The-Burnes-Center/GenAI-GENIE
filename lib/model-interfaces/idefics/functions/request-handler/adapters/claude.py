import json
import os
import re

import boto3

from .base import MultiModalModelBase
from genai_core.types import ChatbotMessageType, Modality
from genai_core.clients import get_bedrock_client
from genai_core.bedrock_converse import build_converse_request, get_text
from genai_core.registry import registry

IMAGE_FORMATS = {"png": "png", "jpeg": "jpeg", "jpg": "jpeg", "gif": "gif", "webp": "webp"}
DEFAULT_IMAGE_FORMAT = "jpeg"
# Converse document formats. Files with other extensions are sent as images, as before.
DOCUMENT_FORMATS = {"pdf", "csv", "doc", "docx", "xls", "xlsx", "html", "txt", "md"}
# Converse limits per request. The document size limit is 4.5 MB, kept as 4.5 million bytes.
MAX_DOCUMENTS = 5
MAX_IMAGES = 20
MAX_DOCUMENT_BYTES = 4_500_000
MAX_DOCUMENT_NAME_LENGTH = 100
DOCUMENT_NAME_INVALID_CHARS = re.compile(r"[^A-Za-z0-9()\[\] -]+")


class FileTooLargeError(Exception):
    def __init__(self, label: str):
        super().__init__(label)
        self.label = label


def get_extension(key: str) -> str:
    return key.rsplit(".", 1)[-1].lower() if "." in key else ""


def is_document(key: str) -> bool:
    return get_extension(key) in DOCUMENT_FORMATS


def get_image_format(key: str) -> str:
    return IMAGE_FORMATS.get(get_extension(key), DEFAULT_IMAGE_FORMAT)


def get_s3_object(key: str) -> dict:
    s3 = boto3.client("s3")
    return s3.get_object(
        Bucket=os.environ["CHATBOT_FILES_BUCKET_NAME"], Key=f"public/{key}"
    )


def get_image_bytes(key: str) -> bytes:
    return get_s3_object(key)["Body"].read()


def get_document_bytes(key: str, label: str) -> bytes:
    response = get_s3_object(key)
    if response["ContentLength"] > MAX_DOCUMENT_BYTES:
        response["Body"].close()
        raise FileTooLargeError(label)
    return response["Body"].read()


def get_file_block(file: dict) -> dict:
    # Only keys are stored in the prompt so it stays JSON-safe and small for chat history
    key = file["key"]
    if is_document(key):
        label = file.get("name") or "Untitled document"
        return {"document": {"key": key, "format": get_extension(key), "label": label}}
    return {"image": {"key": key, "format": get_image_format(key)}}


def get_file_kind(block: dict):
    if "document" in block:
        return "document"
    if "image" in block:
        return "image"
    return None


def get_document_name(label: str, position: int, used_names: set) -> str:
    """Make a Converse document name that is unique within the request.

    Converse allows letters, digits, single spaces, hyphens, parentheses and square brackets.
    """
    base = label.rsplit(".", 1)[0] if "." in label else label
    cleaned = DOCUMENT_NAME_INVALID_CHARS.sub(" ", base)
    cleaned = " ".join(cleaned.split())[:MAX_DOCUMENT_NAME_LENGTH].strip()
    if not cleaned:
        cleaned = f"Document {position}"

    name = cleaned
    suffix = 2
    while name in used_names:
        name = f"{cleaned} ({suffix})"
        suffix += 1
    used_names.add(name)
    return name


def add_turn(turns: list, role: str, content: list):
    """Append content to the turns, merging consecutive turns of the same role.

    Converse requires alternating roles that start with a user turn, and blank text blocks
    are rejected, so both are handled here.
    """
    content = [
        block
        for block in content
        if get_file_kind(block) or block["text"].strip()
    ]
    if not content:
        return
    if not turns and role != "user":
        return
    if turns and turns[-1]["role"] == role:
        turns[-1]["content"].extend(content)
    else:
        turns.append({"role": role, "content": content})


def limit_file_blocks(turns: list):
    """Keep the newest documents and images. Older ones become a short note."""
    limits = {"document": MAX_DOCUMENTS, "image": MAX_IMAGES}
    seen = {"document": 0, "image": 0}
    for turn in reversed(turns):
        for index in reversed(range(len(turn["content"]))):
            block = turn["content"][index]
            kind = get_file_kind(block)
            if kind is None:
                continue
            seen[kind] += 1
            if seen[kind] > limits[kind]:
                if kind == "document":
                    note = f'[Earlier document "{block["document"]["label"]}" not re-sent]'
                else:
                    note = "[Earlier image not re-sent]"
                turn["content"][index] = {"text": note}


def name_documents(turns: list):
    used_names = set()
    position = 0
    for turn in turns:
        for block in turn["content"]:
            if get_file_kind(block) == "document":
                position += 1
                document = block["document"]
                document["name"] = get_document_name(document["label"], position, used_names)


def get_required_modalities(messages: list, files: list) -> set:
    """Return the file modalities (DOCUMENT and/or IMAGE) used by the chat history and new turn."""
    history_files = []
    for message in messages:
        if message.type.lower() == ChatbotMessageType.Human.value.lower():
            history_files += message.additional_kwargs.get("files", [])

    required = set()
    for file in history_files + list(files):
        if is_document(file["key"]):
            required.add(Modality.DOCUMENT.value)
        else:
            required.add(Modality.IMAGE.value)
    return required


class ConverseMultiModal(MultiModalModelBase):
    """Multimodal chat through the Converse API for Bedrock models."""

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
                content = [get_file_block(f) for f in message_files]
                content += [{"text": message.content}]
                add_turn(turns, "user", content)
            if message.type.lower() == ChatbotMessageType.AI.value.lower():
                add_turn(turns, "assistant", [{"text": message.content}])

        # User prompt
        content = [get_file_block(f) for f in files] + [{"text": prompt}]
        add_turn(turns, "user", content)

        limit_file_blocks(turns)
        name_documents(turns)

        return json.dumps({"messages": turns})

    def to_converse_block(self, block: dict) -> dict:
        if "image" in block:
            return {
                "image": {
                    "format": block["image"]["format"],
                    "source": {"bytes": get_image_bytes(block["image"]["key"])},
                }
            }
        if "document" in block:
            document = block["document"]
            return {
                "document": {
                    "format": document["format"],
                    "name": document["name"],
                    "source": {"bytes": get_document_bytes(document["key"], document["label"])},
                }
            }
        return block

    def to_converse_messages(self, prompt: str) -> list:
        return [
            {
                "role": turn["role"],
                "content": [self.to_converse_block(block) for block in turn["content"]],
            }
            for turn in json.loads(prompt)["messages"]
        ]

    def handle_run(self, prompt: str, model_kwargs: dict) -> str:
        print(model_kwargs)
        try:
            messages = self.to_converse_messages(prompt)
        except FileTooLargeError as error:
            print(f"Document over the Converse size limit: {error.label}")
            return f'"{error.label}" is too large to read. Files must be under 4.5 MB.'

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


# Every Bedrock model in the UI is called through Converse, so all of them use this adapter.
registry.register(r"^bedrock\.", ConverseMultiModal)
