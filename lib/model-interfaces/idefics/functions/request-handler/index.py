import os
import json
import uuid
from datetime import datetime
from urllib.parse import urljoin
from adapters import Idefics
from adapters.claude import get_required_modalities

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType
from aws_lambda_powertools.utilities.batch.exceptions import BatchProcessingError
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from aws_lambda_powertools.utilities.typing import LambdaContext

from langchain.llms import SagemakerEndpoint

from genai_core.langchain import DynamoDBChatMessageHistory
from genai_core.utils.websocket import send_to_client
from genai_core.types import ChatbotAction, ChatbotMessageType
from genai_core.models import get_input_modalities
from genai_core.registry import registry

from content_handler import ContentHandler

processor = BatchProcessor(event_type=EventType.SQS)
META_MODEL_ID = "meta_model_as_db_supersecret_id"
BEDROCK_MODEL_ID_FALLBACK = "us.anthropic.claude-haiku-5-5"
tracer = Tracer()
logger = Logger()


def choose_model_id(model_id: str, required_modalities: set) -> str:
    """Use the selected model if it accepts every file type in the chat, otherwise Claude Haiku 5.5."""
    if model_id == META_MODEL_ID:
        logger.info("Smart Model answers file chats with Claude Haiku 5.5")
        return BEDROCK_MODEL_ID_FALLBACK

    supported = set(get_input_modalities(model_id))
    if required_modalities <= supported:
        return model_id

    unsupported = sorted(required_modalities - supported)
    logger.info(f"{model_id} does not accept {unsupported}, using Claude Haiku 5.5")
    return BEDROCK_MODEL_ID_FALLBACK


def handle_run(record):
    print(record)
    user_id = record["userId"]
    data = record["data"]
    provider = data["provider"]
    model_id = data["modelId"]
    mode = data["mode"]
    model_kwargs = data.get("modelKwargs", {})
    prompt = data["text"]
    print('prompt within handle_run', prompt)
    session_id = data.get("sessionId")
    files = data.get("files", [])

    if not files:
        files = []

    if not session_id:
        session_id = str(uuid.uuid4())

    chat_history = DynamoDBChatMessageHistory(
        table_name=os.environ["SESSIONS_TABLE_NAME"],
        session_id=session_id,
        user_id=user_id,
    )

    messages = chat_history.messages

    # The Smart Model router only lives in the langchain interface, so file chats use Haiku
    required_modalities = get_required_modalities(messages, files)
    model_id = choose_model_id(model_id, required_modalities)

    adapter = registry.get_adapter(f"{provider}.{model_id}")

    model = adapter(model_id=model_id)

    prompt_template = model.format_prompt(
        prompt=prompt,
        messages=messages,
        files=files,
    )

    mlm_response = model.handle_run(prompt=prompt_template, model_kwargs=model_kwargs)
    metadata = {
        "provider": provider,
        "modelId": model_id,
        "modelKwargs": model_kwargs,
        "mode": mode,
        "sessionId": session_id,
        "userId": user_id,
        "prompts": [model.clean_prompt(prompt_template)],
        "original_prompt": prompt,
    }
    if files:
        metadata["files"] = files
    chat_history.add_user_message(prompt)
    chat_history.add_metadata(metadata)
    chat_history.add_ai_message(mlm_response)

    response = {
        "sessionId": session_id,
        "type": "text",
        "content": mlm_response,
        "metadata": metadata,
    }

    send_to_client(
        {
            "type": "text",
            "action": ChatbotAction.FINAL_RESPONSE.value,
            "timestamp": str(int(round(datetime.now().timestamp()))),
            "userId": user_id,
            "data": response,
        }
    )


@tracer.capture_method
def record_handler(record: SQSRecord):
    payload: str = record.body
    message: dict = json.loads(payload)
    detail: dict = json.loads(message["Message"])
    logger.info(detail)

    if detail["action"] == ChatbotAction.RUN.value:
        handle_run(detail)


def handle_failed_records(records):
    for triplet in records:
        status, error, record = triplet
        payload: str = record.body
        message: dict = json.loads(payload)
        detail: dict = json.loads(message["Message"])
        logger.info(detail)
        user_id = detail["userId"]
        data = detail.get("data", {})
        session_id = data.get("sessionId", "")

        send_to_client(
            {
                "type": "text",
                "action": ChatbotAction.FINAL_RESPONSE.value,
                "userId": user_id,
                "timestamp": str(int(round(datetime.now().timestamp()))),
                "data": {
                    "sessionId": session_id,
                    "content": str(error),
                    "type": "text",
                },
            }
        )


@logger.inject_lambda_context(log_event=True)
@tracer.capture_lambda_handler
def handler(event, context: LambdaContext):
    batch = event["Records"]

    try:
        with processor(records=batch, handler=record_handler):
            processed_messages = processor.process()
    except BatchProcessingError as e:
        logger.error(e)

    logger.info(processed_messages)
    handle_failed_records(
        message for message in processed_messages if message[0] == "fail"
    )

    return processor.response()
