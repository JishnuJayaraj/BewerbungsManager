from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.schemas.hr4u import Hr4uJob, Hr4uJobDetailResult, Hr4uSearchResponse, SearchBody


class Hr4uConfigError(RuntimeError):
    pass


class Hr4uClientError(RuntimeError):
    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class Hr4uClient:
    def __init__(
        self,
        settings: Settings | None = None,
        *,
        client: httpx.AsyncClient | None = None,
        timeout: float = 20.0,
    ) -> None:
        self.settings = settings or get_settings()
        self.base_url = self._require_base_url(self.settings.hr4u_base_url)
        self.token = self._require_token(self.settings.hr4u_token)
        self._client = client
        self._owns_client = client is None
        self._timeout = timeout

    async def __aenter__(self) -> "Hr4uClient":
        return self

    async def __aexit__(self, exc_type: object, exc: object, traceback: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._client is not None and self._owns_client:
            await self._client.aclose()

    async def autocomplete(self, phrase: str, *, size: int = 10) -> list[Hr4uJob]:
        response = await self._request(
            "GET",
            "/autocomplete",
            params={"phrase": phrase, "size": size},
        )
        payload = response.json()
        if not isinstance(payload, list):
            raise Hr4uClientError("Unexpected HR4U autocomplete response", status_code=response.status_code)
        return [Hr4uJob.model_validate(item) for item in payload]

    async def search(self, body: SearchBody) -> Hr4uSearchResponse:
        response = await self._request("POST", "/search", json=body)
        return Hr4uSearchResponse.model_validate(response.json())

    async def job_detail(self, uuid: str) -> Hr4uJobDetailResult:
        response = await self._request("GET", f"/jobs/{uuid}", allow_expired=True)
        if response.status_code == 404:
            return Hr4uJobDetailResult.expired(uuid)
        return Hr4uJobDetailResult.found(Hr4uJob.model_validate(response.json()))

    async def _request(
        self,
        method: str,
        path: str,
        *,
        allow_expired: bool = False,
        **kwargs: Any,
    ) -> httpx.Response:
        client = self._get_client()
        response = await client.request(
            method,
            self._url(path),
            headers={"Authorization": self.token, "Accept": "application/json"},
            timeout=self._timeout,
            **kwargs,
        )
        if allow_expired and response.status_code == 404:
            return response
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise Hr4uClientError(
                f"HR4U request failed with HTTP {response.status_code}",
                status_code=response.status_code,
            ) from exc
        return response

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient()
        return self._client

    def _url(self, path: str) -> str:
        return f"{self.base_url}/{path.lstrip('/')}"

    @staticmethod
    def _require_base_url(value: str | None) -> str:
        if not value:
            raise Hr4uConfigError("HR4U_BASE_URL is required")
        return value.strip().rstrip("/")

    @staticmethod
    def _require_token(value: str | None) -> str:
        if not value:
            raise Hr4uConfigError("HR4U_TOKEN is required")
        return value.strip()


def build_search_body(
    *,
    queries: Sequence[Mapping[str, Any]] | None = None,
    filters: Sequence[Mapping[str, Any]] | None = None,
    aggregations: Sequence[str] | None = None,
    highlighting: Mapping[str, Any] | None = None,
    sort: Mapping[str, Any] | None = None,
    page: int | None = None,
    size: int | None = None,
) -> SearchBody:
    body: SearchBody = {}
    if queries is not None:
        body["queries"] = [dict(query) for query in queries]
    if filters is not None:
        body["filters"] = [dict(search_filter) for search_filter in filters]
    if aggregations is not None:
        body["aggregations"] = list(aggregations)
    if highlighting is not None:
        body["highlighting"] = dict(highlighting)
    if sort is not None:
        body["sort"] = dict(sort)
    if page is not None:
        body["page"] = page
    if size is not None:
        body["size"] = size
    return body
