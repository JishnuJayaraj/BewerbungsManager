"""Application configuration.

The default LLM provider is Mistral so local/GDPR-sensitive development starts with the EU
provider. Cloud providers such as Anthropic and OpenAI are opt-in via explicit environment
configuration and their tokens are never exposed by API settings responses.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]

LlmProvider = Literal["mistral", "anthropic", "openai"]


class Settings(BaseSettings):
    """Environment-backed settings for backend-owned secrets and runtime options."""

    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    hr4u_base_url: str | None = Field(default=None, alias="HR4U_BASE_URL")
    hr4u_token: str | None = Field(default=None, alias="HR4U_TOKEN")

    llm_default_provider: LlmProvider = Field(default="mistral", alias="LLM_DEFAULT_PROVIDER")
    llm_default_model: str | None = Field(default=None, alias="LLM_DEFAULT_MODEL")
    llm_generate_model: str | None = Field(default=None, alias="LLM_GENERATE_MODEL")
    llm_parse_model: str | None = Field(default=None, alias="LLM_PARSE_MODEL")
    llm_cv_parse_model: str | None = Field(default=None, alias="LLM_CV_PARSE_MODEL")
    llm_suggest_model: str | None = Field(default=None, alias="LLM_SUGGEST_MODEL")
    llm_fit_model: str | None = Field(default=None, alias="LLM_FIT_MODEL")
    llm_enrich_model: str | None = Field(default=None, alias="LLM_ENRICH_MODEL")

    anthropic_api_key: str | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    mistral_api_key: str | None = Field(default=None, alias="MISTRAL_API_KEY")

    database_url: str = Field(default="sqlite:///./jobcraft.db", alias="DATABASE_URL")
    single_user: bool = Field(default=True, alias="SINGLE_USER")

    # Days an application can sit in "Applied" with no movement before it's flagged as gone quiet.
    ghost_threshold_days: int = Field(default=21, alias="GHOST_THRESHOLD_DAYS")


@lru_cache
def get_settings() -> Settings:
    return Settings()
