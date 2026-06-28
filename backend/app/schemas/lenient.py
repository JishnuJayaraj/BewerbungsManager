"""Shared coercion helpers for LLM output models.

LLMs (especially smaller ones) are loose with exact JSON: they alias keys
("text" vs "claim"), return a list where we expect a string, vary enum casing
("German" vs "DE"), and leave inline citation markers in prose. These helpers
centralise the tolerance so every LLM-output schema behaves consistently and we
stop fixing the same class of bug per-field.
"""

from __future__ import annotations

import re
from typing import Any

# Inline citation markers the model sometimes leaves in body text,
# e.g. "[evidence_ref:experience:uuid]" or "[skill:uuid]". Citations live in `claims`.
_REF_MARKER = re.compile(r"\s*\[\s*(?:evidence_ref|experience|skill|project|job)\b[^\]]*\]", re.IGNORECASE)


def strip_refs(text: str) -> str:
    cleaned = _REF_MARKER.sub("", text)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r" +([.,;:])", r"\1", cleaned)
    return cleaned.strip()


def as_text(value: Any, *, refs: bool = True) -> str:
    """A list of paragraphs/lines -> a single string; None -> ''. Optionally strip ref markers."""
    if isinstance(value, list):
        text = "\n\n".join(str(part).strip() for part in value if part)
    elif value is None:
        text = ""
    else:
        text = value if isinstance(value, str) else str(value)
    return strip_refs(text) if refs else text.strip()


def as_str_list(value: Any, *, refs: bool = True) -> list[str]:
    """A string -> [string]; a list -> [str, ...] dropping empties; anything else -> []."""
    if isinstance(value, str):
        items = [value]
    elif isinstance(value, list):
        items = [str(item) for item in value if item is not None and str(item).strip()]
    else:
        return []
    return [strip_refs(item) if refs else item.strip() for item in items]


def pick(data: dict[str, Any], *keys: str, default: str = "") -> str:
    """First present, non-empty string value among the given keys."""
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value
        if value not in (None, "", [], {}):
            return str(value)
    return default


def as_language(value: Any) -> Any:
    """Normalise language to the DE/EN enum values; leave unknowns for the enum to reject."""
    text = str(value or "").strip().lower()
    if text in {"de", "german", "deutsch"}:
        return "DE"
    if text in {"en", "english", "englisch"}:
        return "EN"
    return value


def coerce_enum(value: Any, mapping: dict[str, str], default: str) -> str:
    """Map loose enum text (any casing/synonym) to a canonical value, falling back to default."""
    text = str(value or "").strip().upper()
    return mapping.get(text, default)
