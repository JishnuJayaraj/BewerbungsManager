from __future__ import annotations

import json
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Literal, TypeVar

import litellm
from pydantic import BaseModel, TypeAdapter, ValidationError

from app.config import Settings, get_settings

LlmTask = Literal["cv_parse", "suggest", "fit", "generate", "enrich", "quickfit"]
Message = Mapping[str, str]
T = TypeVar("T")


class LlmConfigError(RuntimeError):
    pass


class LlmCompletionError(RuntimeError):
    pass


@dataclass(frozen=True)
class LlmResolvedConfig:
    provider: str
    model: str
    api_key: str


CompletionCallable = Callable[..., Awaitable[Any]]


class LlmService:
    def __init__(
        self,
        settings: Settings | None = None,
        *,
        completion: CompletionCallable | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self._completion = completion or litellm.acompletion

    async def complete(
        self,
        messages: Sequence[Message],
        *,
        task: LlmTask,
        response_model: type[T] | TypeAdapter[T] | None = None,
    ) -> T | dict[str, Any]:
        resolved = resolve_task_config(self.settings, task)
        last_error: Exception | None = None
        attempt_messages: list[dict[str, str]] = [dict(message) for message in messages]

        for attempt in range(2):
            response = await self._completion(
                model=resolved.model,
                messages=attempt_messages,
                api_key=resolved.api_key,
                response_format={"type": "json_object"},
            )
            content = _extract_content(response)
            try:
                return _validate_json(content, response_model)
            except (json.JSONDecodeError, ValidationError) as exc:
                last_error = exc
                if attempt == 1:
                    break
                attempt_messages = [
                    *attempt_messages,
                    {"role": "assistant", "content": content},
                    {
                        "role": "user",
                        "content": (
                            "The previous response was not valid JSON for the required schema. "
                            "Return only a corrected JSON object with no prose or markdown fences."
                        ),
                    },
                ]

        raise LlmCompletionError("LLM response did not validate as structured JSON") from last_error


async def complete(
    messages: Sequence[Message],
    *,
    task: LlmTask,
    response_model: type[T] | TypeAdapter[T] | None = None,
    settings: Settings | None = None,
) -> T | dict[str, Any]:
    return await LlmService(settings).complete(messages, task=task, response_model=response_model)


def resolve_task_config(settings: Settings, task: LlmTask) -> LlmResolvedConfig:
    provider = settings.llm_default_provider
    model = _model_for_task(settings, task)
    if not model:
        raise LlmConfigError(f"LLM model is required for task {task!r}")

    api_key = _api_key_for_provider(settings, provider)
    if not api_key:
        raise LlmConfigError(f"API key is required for LLM provider {provider!r}")

    return LlmResolvedConfig(
        provider=provider,
        model=_litellm_model(provider, model),
        api_key=api_key,
    )


def _model_for_task(settings: Settings, task: LlmTask) -> str | None:
    match task:
        case "cv_parse":
            return settings.llm_cv_parse_model or settings.llm_parse_model or settings.llm_default_model
        case "suggest":
            return settings.llm_suggest_model or settings.llm_parse_model or settings.llm_default_model
        case "fit":
            return settings.llm_fit_model or settings.llm_default_model
        case "generate":
            return settings.llm_generate_model or settings.llm_default_model
        case "enrich":
            return settings.llm_enrich_model or settings.llm_parse_model or settings.llm_default_model
        case "quickfit":
            return settings.llm_quickfit_model or settings.llm_parse_model or settings.llm_default_model


def _api_key_for_provider(settings: Settings, provider: str) -> str | None:
    match provider:
        case "mistral":
            return settings.mistral_api_key
        case "anthropic":
            return settings.anthropic_api_key
        case "openai":
            return settings.openai_api_key
        case _:
            raise LlmConfigError(f"Unsupported LLM provider {provider!r}")


def _litellm_model(provider: str, model: str) -> str:
    if "/" in model:
        return model
    return f"{provider}/{model}"


def _extract_content(response: Any) -> str:
    try:
        content = response.choices[0].message.content
    except AttributeError:
        content = response["choices"][0]["message"]["content"]
    if not isinstance(content, str):
        raise LlmCompletionError("LLM response did not include string content")
    return content


def _validate_json(
    content: str,
    response_model: type[T] | TypeAdapter[T] | None,
) -> T | dict[str, Any]:
    parsed = json.loads(content)
    if response_model is None:
        return TypeAdapter(dict[str, Any]).validate_python(parsed)
    if isinstance(response_model, TypeAdapter):
        return response_model.validate_python(parsed)
    if isinstance(response_model, type) and issubclass(response_model, BaseModel):
        return response_model.model_validate(parsed)
    return TypeAdapter(response_model).validate_python(parsed)
