"""Tech Decisions Agent — scores and justifies technology choices per architecture tier.

Reads:  state["constraints"], state["architectures"]
Writes: state["tech_decisions"], state["current_agent"], state["error"]

Follows the same retry + validation pattern as requirements and design agents.
"""

import json
from typing import Optional

from pydantic import ValidationError

from backend.llm import get_client, get_model_name
from backend.prompts.tech_decisions import build_tech_decisions_prompt
from backend.state import ArchieState, TechDecisionsOutput, TierDecisions


_MAX_ATTEMPTS = 3


def tech_decisions_agent(state: ArchieState) -> dict:
    constraints = state.get("constraints")
    architectures = state.get("architectures")

    if not constraints or not architectures:
        return {
            "tech_decisions": None,
            "current_agent": "tech_decisions",
            "error": "Tech decisions agent missing constraints or architectures.",
        }

    client = get_client()
    system_prompt, user_prompt = build_tech_decisions_prompt(constraints, architectures)

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
            temperature=0.3,
            max_tokens=4000,
        )

        raw_output = (response.choices[0].message.content or "").strip()

        if raw_output.startswith("```"):
            lines = raw_output.splitlines()
            raw_output = "\n".join(
                l for l in lines if not l.strip().startswith("```")
            ).strip()

        try:
            data = json.loads(raw_output)
        except json.JSONDecodeError as e:
            last_error = f"JSON parse error: {e}"
            continue

        if "tech_decisions" not in data:
            last_error = "Missing top-level 'tech_decisions' key."
            continue

        try:
            output = TechDecisionsOutput(
                tech_decisions=[TierDecisions(**t) for t in data["tech_decisions"]]
            )
        except (ValidationError, TypeError) as e:
            last_error = f"Schema validation error:\n{e}"
            continue

        return {
            "tech_decisions": [t.model_dump() for t in output.tech_decisions],
            "current_agent": "complete",
            "error": None,
        }

    return {
        "tech_decisions": None,
        "current_agent": "tech_decisions",
        "error": f"Tech decisions agent failed after {_MAX_ATTEMPTS} attempts. Last error: {last_error}",
    }