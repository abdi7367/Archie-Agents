"""Design Agent — generates 3 architecture tiers from validated constraints.

Produces:
  - MVP architecture        (ship fast, minimal ops overhead)
  - Production architecture (handles stated load reliably)
  - Future-scale            (handles 10x growth)

Each architecture includes:
  - components, data_flow, scaling_approach, observability,
    security, tradeoffs, and a Mermaid diagram string

Returns a partial ArchieState dict for LangGraph to merge.
"""

import json
from functools import lru_cache
from typing import Optional

from pydantic import ValidationError

from backend.llm import get_client, get_model_name
from backend.prompts.design import build_design_prompt
from backend.state import ArchieState, Architecture, DesignOutput


_MAX_ATTEMPTS = 3



def design_agent(state: ArchieState) -> dict:
    """
    Generate 3 architecture options from the validated constraints.

    Reads:  state["constraints"]
    Writes: state["architectures"], state["current_agent"], state["error"]
    """
    constraints = state.get("constraints")
    if not constraints:
        return {
            "architectures": None,
            "current_agent": "design",
            "error": "Design agent received no constraints — requirements agent may have failed.",
        }

    client = get_client()
    system_prompt, user_prompt = build_design_prompt(constraints)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_prompt},
    ]

    last_error: Optional[str] = None
    raw_output: Optional[str] = None

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        if attempt > 1 and last_error and raw_output:
            messages.append({"role": "assistant", "content": raw_output})
            messages.append({
                "role": "user",
                "content": (
                    f"Your previous response failed validation:\n{last_error}\n\n"
                    "Fix the JSON and return only valid JSON. No markdown, no backticks."
                ),
            })

        response = client.chat.completions.create(
            model=get_model_name(),
            messages=messages,
            temperature=0.4,    # slight creativity for architecture variety
            max_tokens=4000,    # 3 detailed architectures need room
        )

        raw_output = (response.choices[0].message.content or "").strip()

        # Strip accidental markdown fences
        if raw_output.startswith("```"):
            lines = raw_output.splitlines()
            raw_output = "\n".join(
                l for l in lines if not l.strip().startswith("```")
            ).strip()

        # Parse JSON
        try:
            data = json.loads(raw_output)
        except json.JSONDecodeError as e:
            last_error = f"JSON parse error: {e}"
            continue

        # Expect {"architectures": [...]}
        if "architectures" not in data:
            last_error = "Missing top-level 'architectures' key."
            continue

        # Validate each architecture against the Pydantic model
        try:
            output = DesignOutput(
                architectures=[Architecture(**a) for a in data["architectures"]]
            )
        except (ValidationError, TypeError) as e:
            last_error = f"Schema validation error:\n{e}"
            continue

        return {
            "architectures": [a.model_dump() for a in output.architectures],
            "current_agent": "tech_decisions",
            "error": None,
        }

    return {
        "architectures": None,
        "current_agent": "design",
        "error": f"Design agent failed after {_MAX_ATTEMPTS} attempts. Last error: {last_error}",
    }