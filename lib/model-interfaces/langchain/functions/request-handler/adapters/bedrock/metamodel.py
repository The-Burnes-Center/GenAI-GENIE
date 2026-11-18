import genai_core.clients
import os
from botocore.exceptions import ClientError
from aws_lambda_powertools import Logger

from .base import Bedrock
from ..base import ModelAdapter
from genai_core.registry import registry
from genai_core.models import CURATED_BEDROCK_MODELS
from genai_core.bedrock_converse import build_converse_request, get_text

logger = Logger()

# The router only ever picks from the curated list, so it can never suggest a retired model
MODEL_ID_BY_NAME = {model["name"]: model["modelId"] for model in CURATED_BEDROCK_MODELS}
MODEL_NAMES = list(MODEL_ID_BY_NAME)
DEFAULT_MODEL_NAME = "Claude Haiku 5.5"
DEFAULT_MODEL_ID = MODEL_ID_BY_NAME[DEFAULT_MODEL_NAME]
CSV_FILE_NAME = "Bedrock_LLM_Guide - Main.csv"


class BedrockMetaModelAdapter(ModelAdapter):
    def __init__(self, session_id, user_id, model_id="meta_model_as_db_supersecret_id",
                 model_kwargs={}, *args, **kwargs):
        # Initialize the model_id for this instance
        self.model_id = model_id

        # Call the superclass constructor with all required and optional parameters
        super().__init__(session_id, user_id, model_kwargs=model_kwargs, *args, **kwargs)

    def get_llm(self, model_kwargs={}):
        bedrock = genai_core.clients.get_bedrock_client()
        params = {}
        if "maxTokens" in model_kwargs:
            params["max_tokens"] = model_kwargs["maxTokens"]

        return Bedrock(
            client=bedrock,
            model_id=DEFAULT_MODEL_ID,
            model_kwargs=params,
            streaming=model_kwargs.get("streaming", False),
            callbacks=[self.callback_handler],
        )

    def get_csv_data_as_text(self):
        directory = os.path.dirname(os.path.abspath(__file__))
        filepath = os.path.join(directory, CSV_FILE_NAME)
        try:
            with open(filepath, "r") as file:
                return file.read()
        except Exception as e:
            logger.error(f"Error reading CSV data: {str(e)}")
            return None

    model_id_data = MODEL_ID_BY_NAME

    def build_router_prompt(self, csv_data, user_prompt):
        model_list = "\n".join(MODEL_NAMES)
        return f"""Decision-Making Task with Model Name Consistency:

Context: You are tasked with evaluating a dataset detailing various language models to determine the most suitable one for a specific user request. The dataset provides insights on model capabilities, use cases, and relative cost.

Input Data:

CSV Dataset: {csv_data}
User Prompt: {user_prompt}

Output Expectation: Respond with the exact model name from the list provided below, ensuring spelling accuracy. Your response should consist only of this model name, without additional commentary.

List of Models for Consistency:
{model_list}

Procedure:

Understand the User Prompt: Analyze the details of the user's request, including task requirements and any specific constraints.
Evaluate Based on Criteria: Use the dataset to assess which model best aligns with the user's needs, considering factors like task complexity, language support, and relative cost. Prefer the lower cost models for simple requests. (for any language other than English, please use the Claude Sonnet 5.5 model)
Make Your Decision: Identify the most appropriate model from the list above to handle the user's request, based on your analysis.
Expected Output: Provide the selected model's name exactly as it appears in the list above. This ensures clarity and uniformity in the response, facilitating seamless further processing.

Note: It is crucial to adhere to the requested output format, delivering only the name of the chosen model with exact spelling as listed, to maintain consistency across all responses."""

    def get_model_suggestion(self, user_prompt):
        csv_data = self.get_csv_data_as_text()
        if not csv_data:
            logger.error("Error reading CSV data.")
            return DEFAULT_MODEL_ID

        base_prompt = self.build_router_prompt(csv_data, user_prompt)

        bedrock = genai_core.clients.get_bedrock_client()
        try:
            response = bedrock.converse(
                messages=[{"role": "user", "content": [{"text": base_prompt}]}],
                **build_converse_request(DEFAULT_MODEL_ID, max_tokens=1024),
                modelId=DEFAULT_MODEL_ID,
            )
            model_name = get_text(response["output"]["message"]["content"])
            return self.model_id_data.get(self.check_model_and_return(model_name))
        except ClientError as err:
            logger.error(
                f"Couldn't invoke model. Error: {err.response['Error']['Code']}: {err.response['Error']['Message']}")
            return None

    def check_model_and_return(self, model_name):
        # Tolerate stray whitespace, quotes, backticks, or a trailing period from the router
        cleaned = model_name.strip().strip("\"'`*.").strip().lower()
        for name in MODEL_NAMES:
            if name.lower() == cleaned:
                return name
        logger.warning(f"Router returned an unknown model name: {model_name!r}")
        return DEFAULT_MODEL_NAME


# Register the adapter
registry.register(r"^bedrock.meta_model_as_db_supersecret_id", BedrockMetaModelAdapter)
