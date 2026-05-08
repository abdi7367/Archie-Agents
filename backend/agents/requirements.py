"""Requirements Agent — extracts structured constraints from user input.

Changes from v1:
- Client is lazily initialized (no crash-on-import without API key)
- LLM output is validated against Constraints Pydantic model
- On validation failure, re-prompts with the error and partial data (up to 3 attempts)
- Returns a proper partial ArchieState dict, not a raw JSON blob
- Prompt schema is auto-generated from the Pydantic model to prevent drift
"""

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from groq import Client
from pydantic import ValidationError

from backend.state import ArchieState, Constraints
from backend.prompts.requirements import build_requirements_prompt


# ── Lazy client — never crashes on import ────────────────────────────────────

def _load_groq_api_key() -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if api_key:
        return api_key

    env_path = Path(__file__).resolve().parents[1] / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            parsed = line.strip()
            if not parsed or parsed.startswith("#") or "=" not in parsed:
                continue
            key, value = parsed.split("=", 1)
            if key.strip() == "GROQ_API_KEY" and value.strip():
                os.environ["GROQ_API_KEY"] = value.strip()
                return value.strip()

    raise RuntimeError(
        "Missing GROQ_API_KEY. Set it in your environment or add "
        "GROQ_API_KEY=... to backend/.env."
    )


@lru_cache(maxsize=1)
def _get_client() -> Client:
    """Return a cached Groq client. Initialized on first call only."""
    return Client(api_key=_load_groq_api_key())


# ── Agent ────────────────────────────────────────────────────────────────────

_MAX_ATTEMPTS = 3
_MODEL = "llama-3.3-70b-versatile"


def requirements_agent(state: ArchieState) -> dict:
    """
    Extract structured constraints from the user's product description.

    Runs up to _MAX_ATTEMPTS times:
      - Attempt 1: plain extraction from user_input
      - Attempt 2+: re-prompt with the validation error and the partial output
        so the model can self-correct

    Returns a partial ArchieState dict. LangGraph merges this into the full state.
    """
    client = _get_client()
    system_prompt = build_requirements_prompt()

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": state["user_input"]},
    ]

    last_error: Optional[str] = None
    raw_output: Optional[str] = None

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        # On retry, tell the model exactly what was wrong
        if attempt > 1 and last_error and raw_output:
            messages.append({
                "role": "assistant",
                "content": raw_output,
            })
            messages.append({
                "role": "user",
                "content": (
                    f"Your previous response failed validation with this error:\n"
                    f"{last_error}\n\n"
                    "Please fix the JSON and return only valid JSON that matches "
                    "the schema. No explanation, no markdown."
                ),
            })

        response = client.chat.completions.create(
            model=_MODEL,
            messages=messages,
            temperature=0.2,       # lower = more deterministic JSON
            max_tokens=1000,
        )

        raw_output = (response.choices[0].message.content or "").strip()

        # Strip accidental markdown code fences
        if raw_output.startswith("```"):
            lines = raw_output.splitlines()
            raw_output = "\n".join(
                line for line in lines
                if not line.strip().startswith("```")
            ).strip()

        # Parse JSON
        try:
            data = json.loads(raw_output)
        except json.JSONDecodeError as e:
            last_error = f"JSON parse error: {e}"
            continue

        # Validate against Pydantic schema
        try:
            constraints = Constraints(**data)
        except ValidationError as e:
            last_error = f"Schema validation error:\n{e}"
            continue

        # Success — return a partial state update
        return {
            "constraints": constraints,
            "current_agent": "design",
            "error": None,
        }

    # All attempts exhausted
    return {
        "constraints": None,
        "current_agent": "requirements",
        "error": (
            f"Requirements agent failed after {_MAX_ATTEMPTS} attempts. "
            f"Last error: {last_error}"
        ),
    }