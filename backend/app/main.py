from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import Settings, get_settings
from app.routers import applications, fit, generate, jobs, profile, search


class SettingsResponse(BaseModel):
    llm_provider: str
    single_user: bool
    gdpr_notice: str


def error_payload(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    app = FastAPI(title="JobCraft API", version="0.1.0")

    @app.middleware("http")
    async def unhandled_error_shape(
        request: Request,
        call_next: Callable[[Request], Awaitable[Any]],
    ) -> Any:
        try:
            return await call_next(request)
        except Exception:
            return JSONResponse(
                status_code=500,
                content=error_payload("internal_error", "Internal server error"),
            )

    @app.exception_handler(HTTPException)
    async def fastapi_http_exception_handler(
        request: Request,
        exc: HTTPException,
    ) -> JSONResponse:
        code, message, details = _error_parts(exc.status_code, exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(code, message, details),
            headers=exc.headers,
        )

    @app.exception_handler(StarletteHTTPException)
    async def starlette_http_exception_handler(
        request: Request,
        exc: StarletteHTTPException,
    ) -> JSONResponse:
        code = _code_for_status(exc.status_code)
        message = exc.detail if isinstance(exc.detail, str) else "Request failed"
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(code, message),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=error_payload(
                "validation_error",
                "Request validation failed",
                {"errors": jsonable_encoder(exc.errors())},
            ),
        )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/settings", response_model=SettingsResponse)
    async def read_settings() -> SettingsResponse:
        return SettingsResponse(
            llm_provider=app_settings.llm_default_provider,
            single_user=app_settings.single_user,
            gdpr_notice=(
                "LLM processing defaults to the EU provider Mistral. Cloud providers such as "
                "Anthropic or OpenAI are opt-in and CV/job text may be sent to the configured "
                "provider during generation."
            ),
        )

    app.include_router(search.router)
    app.include_router(jobs.router)
    app.include_router(profile.router)
    app.include_router(applications.router)
    app.include_router(fit.router)
    app.include_router(generate.router)

    return app


def _error_parts(status_code: int, detail: Any) -> tuple[str, str, dict[str, Any]]:
    if isinstance(detail, dict):
        code = str(detail.get("code") or _code_for_status(status_code))
        message = str(detail.get("message") or "Request failed")
        details = detail.get("details")
        return code, message, details if isinstance(details, dict) else {}
    return _code_for_status(status_code), detail if isinstance(detail, str) else "Request failed", {}


def _code_for_status(status_code: int) -> str:
    match status_code:
        case 404:
            return "not_found"
        case 409:
            return "conflict"
        case 410:
            return "job_expired"
        case 422:
            return "validation_error"
        case _ if status_code >= 500:
            return "internal_error"
        case _:
            return "request_error"


app = create_app()
