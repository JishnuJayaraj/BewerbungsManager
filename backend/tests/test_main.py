from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def isolated_settings(**overrides: object) -> Settings:
    return Settings(_env_file=None, **overrides)


def test_health() -> None:
    client = TestClient(create_app(isolated_settings()))

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_settings_excludes_secrets_and_defaults_to_mistral(monkeypatch) -> None:
    monkeypatch.delenv("LLM_DEFAULT_PROVIDER", raising=False)
    monkeypatch.delenv("LLM_DEFAULT_MODEL", raising=False)
    settings = Settings(
        _env_file=None,
        HR4U_TOKEN="secret-hr4u",
        ANTHROPIC_API_KEY="secret-anthropic",
        OPENAI_API_KEY="secret-openai",
    )
    client = TestClient(create_app(settings))

    response = client.get("/api/settings")

    assert response.status_code == 200
    body = response.json()
    assert body["llm_provider"] == "mistral"
    assert body["single_user"] is True
    assert "Mistral" in body["gdpr_notice"]
    assert "secret" not in response.text
    assert "api_key" not in response.text.lower()
    assert "token" not in response.text.lower()


def test_404_uses_api_error_shape() -> None:
    client = TestClient(create_app(isolated_settings()))

    response = client.get("/missing")

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "not_found", "message": "Not Found", "details": {}}
    }


def test_validation_error_uses_api_error_shape() -> None:
    app = create_app(isolated_settings())

    @app.get("/requires-int")
    async def requires_int(value: int) -> dict[str, int]:
        return {"value": value}

    client = TestClient(app)

    response = client.get("/requires-int", params={"value": "nope"})

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["message"] == "Request validation failed"
    assert body["error"]["details"]["errors"]


def test_http_exception_uses_status_code_mapping() -> None:
    app = create_app(isolated_settings())

    @app.get("/conflict")
    async def conflict() -> None:
        raise HTTPException(status_code=409, detail="Already exists")

    client = TestClient(app)

    response = client.get("/conflict")

    assert response.status_code == 409
    assert response.json() == {
        "error": {"code": "conflict", "message": "Already exists", "details": {}}
    }
