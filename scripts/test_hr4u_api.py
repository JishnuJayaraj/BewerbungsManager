#!/usr/bin/env python3
"""Smoke tests for the HR4YOU Job Search API.

Reads HR4U_TOKEN from .env by default. The API docs in docs/docs.md only
contain relative paths, so provide the host with HR4U_BASE_URL or --base-url.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DEFAULT_PHRASE = "Python"
DEFAULT_TIMEOUT_SECONDS = 20


class ConfigError(RuntimeError):
    pass


@dataclass
class ApiResponse:
    status: int
    body: Any
    elapsed_ms: int


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def normalize_base_url(value: str | None) -> str:
    if not value:
        raise ConfigError("Missing API host. Set HR4U_BASE_URL in .env or pass --base-url.")

    base_url = value.strip().rstrip("/")
    parsed = urllib.parse.urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ConfigError(f"Invalid base URL: {value!r}")
    return base_url


def require_token() -> str:
    token = os.environ.get("HR4U_TOKEN", "").strip()
    if not token:
        raise ConfigError("Missing HR4U_TOKEN in .env or environment.")
    return token


def build_url(base_url: str, path: str, query: dict[str, Any] | None = None) -> str:
    url = f"{base_url}/{path.lstrip('/')}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"
    return url


def json_request(
    *,
    base_url: str,
    path: str,
    token: str | None,
    method: str = "GET",
    query: dict[str, Any] | None = None,
    payload: dict[str, Any] | None = None,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> ApiResponse:
    headers = {"Accept": "application/json"}
    if payload is not None:
        headers["Content-Type"] = "application/json"

    if token:
        headers["Authorization"] = token

    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        build_url(base_url, path, query),
        data=data,
        headers=headers,
        method=method,
    )

    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            status = response.status
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        status = exc.code
    elapsed_ms = int((time.monotonic() - started) * 1000)

    try:
        body = json.loads(raw.decode("utf-8")) if raw else None
    except json.JSONDecodeError:
        body = raw.decode("utf-8", errors="replace")

    return ApiResponse(status=status, body=body, elapsed_ms=elapsed_ms)


def assert_status(name: str, response: ApiResponse, expected: set[int]) -> None:
    if response.status not in expected:
        preview = json.dumps(response.body, ensure_ascii=False)[:700]
        raise AssertionError(
            f"{name} returned HTTP {response.status}, expected {sorted(expected)}. "
            f"Body preview: {preview}"
        )


def assert_json_type(name: str, response: ApiResponse, expected_type: type) -> None:
    if not isinstance(response.body, expected_type):
        raise AssertionError(f"{name} returned {type(response.body).__name__}, expected {expected_type.__name__}.")


def title_for_job(job: dict[str, Any]) -> str:
    text = job.get("text")
    if isinstance(text, dict) and text.get("title"):
        return str(text["title"])
    return "<missing title>"


def run_tests(args: argparse.Namespace) -> int:
    load_dotenv(Path(args.env_file))
    token = require_token()
    base_url = normalize_base_url(args.base_url or os.environ.get("HR4U_BASE_URL"))

    print(f"Testing HR4YOU API at {base_url}")
    print("Token: present (sent as raw Authorization header, not printed)")

    autocomplete = json_request(
        base_url=base_url,
        path="/autocomplete",
        token=token,
        query={"phrase": args.phrase, "size": args.size},
        timeout=args.timeout,
    )
    assert_status("autocomplete", autocomplete, {200})
    assert_json_type("autocomplete", autocomplete, list)
    print(
        f"PASS autocomplete: HTTP {autocomplete.status}, "
        f"{len(autocomplete.body)} suggestions, {autocomplete.elapsed_ms} ms"
    )

    search_payload = {
        "queries": [
            {
                "autocomplete": False,
                "fields": ["text.title", "text.fulltext", "company"],
                "phrase": args.phrase,
                "queryType": "should",
                "type": "single",
            }
        ],
        "highlighting": {
            "fields": ["text.title", "text.fulltext"],
            "preTag": "<mark>",
            "postTag": "</mark>",
        },
        "aggregations": ["employmentTypes", "jobTypes", "topWorkPlaces"],
        "page": 1,
        "size": args.size,
    }
    search = json_request(
        base_url=base_url,
        path="/search",
        token=token,
        method="POST",
        payload=search_payload,
        timeout=args.timeout,
    )
    assert_status("search", search, {200})
    assert_json_type("search", search, dict)
    jobs = search.body.get("jobs")
    if not isinstance(jobs, list):
        raise AssertionError("search response did not include a jobs list.")
    hits = search.body.get("hits", "unknown")
    print(
        f"PASS search: HTTP {search.status}, hits={hits}, jobs_on_page={len(jobs)}, "
        f"{search.elapsed_ms} ms"
    )

    if jobs:
        first_job = jobs[0]
        if not isinstance(first_job, dict) or not first_job.get("uuid"):
            raise AssertionError("first search result did not include a uuid.")
        uuid = str(first_job["uuid"])
        details = json_request(
            base_url=base_url,
            path=f"/jobs/{urllib.parse.quote(uuid)}",
            token=token,
            timeout=args.timeout,
        )
        assert_status("job details", details, {200})
        assert_json_type("job details", details, dict)
        if details.body.get("uuid") != uuid:
            raise AssertionError("job details uuid did not match the search result uuid.")
        print(
            f"PASS job details: HTTP {details.status}, uuid={uuid}, "
            f"title={title_for_job(details.body)!r}, {details.elapsed_ms} ms"
        )
    else:
        print("SKIP job details: search returned no jobs to fetch by UUID.")

    if args.include_negative_auth:
        unauthenticated = json_request(
            base_url=base_url,
            path="/autocomplete",
            token=None,
            query={"phrase": args.phrase, "size": 1},
            timeout=args.timeout,
        )
        assert_status("unauthenticated autocomplete", unauthenticated, {401, 403})
        print(f"PASS negative auth: HTTP {unauthenticated.status} without token")

    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke test HR4YOU Job Search API endpoints.")
    parser.add_argument("--base-url", help="API host, e.g. https://example.com/api")
    parser.add_argument("--env-file", default=".env", help="Path to dotenv file with HR4U_TOKEN and optional HR4U_BASE_URL")
    parser.add_argument("--phrase", default=DEFAULT_PHRASE, help="Search/autocomplete phrase to test")
    parser.add_argument("--size", type=int, default=3, help="Maximum jobs/suggestions to request")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS, help="HTTP timeout in seconds")
    parser.add_argument(
        "--include-negative-auth",
        action="store_true",
        help="Also verify that a request without Authorization is rejected.",
    )
    return parser.parse_args()


def main() -> int:
    try:
        return run_tests(parse_args())
    except (ConfigError, AssertionError, urllib.error.URLError, TimeoutError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
