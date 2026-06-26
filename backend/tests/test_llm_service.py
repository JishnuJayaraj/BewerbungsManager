import asyncio
from typing import Any

from pydantic import BaseModel

from app.config import Settings
from app.services.llm import LlmService, resolve_task_config


class SimpleAnswer(BaseModel):
    answer: str


def test_complete_retries_once_and_validates_json() -> None:
    calls: list[dict[str, Any]] = []

    async def fake_completion(**kwargs: Any) -> dict[str, Any]:
        calls.append(kwargs)
        content = "not json" if len(calls) == 1 else '{"answer": "repaired"}'
        return {"choices": [{"message": {"content": content}}]}

    service = LlmService(
        Settings(
            LLM_DEFAULT_PROVIDER="mistral",
            LLM_DEFAULT_MODEL="mistral-small",
            MISTRAL_API_KEY="mistral-key",
        ),
        completion=fake_completion,
    )

    async def run_completion() -> SimpleAnswer:
        result = await service.complete(
            [{"role": "user", "content": "Return JSON."}],
            task="fit",
            response_model=SimpleAnswer,
        )
        assert isinstance(result, SimpleAnswer)
        return result

    result = asyncio.run(run_completion())

    assert result == SimpleAnswer(answer="repaired")
    assert len(calls) == 2
    assert calls[0]["model"] == "mistral/mistral-small"
    assert calls[0]["api_key"] == "mistral-key"
    assert calls[0]["response_format"] == {"type": "json_object"}
    assert "corrected JSON object" in calls[1]["messages"][-1]["content"]


def test_resolve_task_config_switches_provider_and_task_model_from_settings() -> None:
    mistral = resolve_task_config(
        Settings(
            LLM_DEFAULT_PROVIDER="mistral",
            LLM_DEFAULT_MODEL="mistral-default",
            LLM_GENERATE_MODEL="mistral-generate",
            MISTRAL_API_KEY="mistral-key",
        ),
        "generate",
    )
    openai = resolve_task_config(
        Settings(
            LLM_DEFAULT_PROVIDER="openai",
            LLM_DEFAULT_MODEL="gpt-test",
            OPENAI_API_KEY="openai-key",
        ),
        "fit",
    )

    assert mistral.provider == "mistral"
    assert mistral.model == "mistral/mistral-generate"
    assert mistral.api_key == "mistral-key"
    assert openai.provider == "openai"
    assert openai.model == "openai/gpt-test"
    assert openai.api_key == "openai-key"
