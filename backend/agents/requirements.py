"""Requirements Agent — two-phase constraint extraction with clarification.
 
Phase 1: Extract what we can, compute per-field confidence.
Phase 2: If overall confidence < threshold, return clarifying questions.
         If confidence is high enough, proceed directly to design.
 
The graph node returns one of two shapes:
  - needs_clarification=True  → questions returned, graph pauses at human node
  - needs_clarification=False → constraints set, graph proceeds to design
"""

import json
import os
from typing import Optional

from pydantic import ValidationError

from backend.llm import create_chat_completion, get_client, get_model_name
from backend.prompts.requirements import (
    CONFIDENCE_THRESHOLD,
    build_extraction_prompt,
    build_merge_prompt,
    build_question_gen_prompt,
)
from backend.state import (
    ArchieState,
    Constraints,
    ExtractionResult,
)

# ── Agent ────────────────────────────────────────────────────────────────────

_MAX_ATTEMPTS = 3


def requirements_agent(state: ArchieState) -> dict:
    """
    Phase 1: Extract constraints and confidence from user_input.

    If clarification_answers exist in state, we're in phase 2 — merge
    the answers into the constraints and finalize.
    """
    client = get_client()
    user_input = state["user_input"]
    answers = state.get("clarification_answers") or {}

    # ── Phase 2: user has answered clarifying questions ───────────────────────
    if answers and state.get("constraints"):
        return _merge_answers(client, user_input, state["constraints"], answers)

    # ── Phase 1: fresh extraction ──────────────────────────────────────────────
    return _extract_and_maybe_ask(client, user_input)


def _extract_and_maybe_ask(client, user_input: str) -> dict:
    """Extract constraints. Return questions if confidence too low, else proceed."""
    system_prompt, user_prompt = build_extraction_prompt(user_input)

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
                    f"Validation failed: {last_error}\n"
                    "Return only valid JSON matching the schema. No markdown."
                ),
            })

        response = create_chat_completion(
            client,
            model=get_model_name(),
            messages=messages,
            temperature=0.2,
            max_tokens=1500,
        )

        raw_output = _strip_fences(response.choices[0].message.content or "")

        try:
            data = json.loads(raw_output)
        except json.JSONDecodeError as e:
            last_error = f"JSON parse error: {e}"
            continue

        try:
            result = ExtractionResult(**data)
        except (ValidationError, TypeError) as e:
            last_error = f"Schema error: {e}"
            continue

        # High confidence — skip questions, go straight to design
        if result.overall_confidence >= CONFIDENCE_THRESHOLD:
            try:
                constraints = Constraints(**result.constraints)
            except (ValidationError, TypeError):
                constraints = _coerce_constraints(result.constraints)

            return {
                "constraints": constraints,
                "clarification_questions": [],
                "assumptions": result.assumptions,
                "overall_confidence": result.overall_confidence,
                "current_agent": "design",
                "error": None,
            }

        # Low confidence — generate questions
        questions = _generate_questions(
            client,
            user_input,
            result.constraints,
            [f.model_dump() for f in result.field_confidence],
            result.overall_confidence,
        )

        # Store partial constraints so we can merge later
        try:
            partial_constraints = Constraints(**result.constraints)
        except (ValidationError, TypeError):
            partial_constraints = _coerce_constraints(result.constraints)

        return {
            "constraints": partial_constraints,
            "clarification_questions": [q.model_dump() for q in questions] if questions else [],
            "assumptions": result.assumptions,
            "overall_confidence": result.overall_confidence,
            "current_agent": "clarifying" if questions else "design",
            "error": None,
        }

    return {
        "constraints": None,
        "clarification_questions": [],
        "current_agent": "requirements",
        "error": f"Requirements agent failed after {_MAX_ATTEMPTS} attempts. Last: {last_error}",
    }


def _generate_questions(
    client,
    user_input: str,
    constraints: dict,
    field_confidence: list,
    overall_confidence: float,
) -> list:
    """Call LLM to generate targeted clarifying questions."""
    from backend.state import ClarificationQuestion, QuestionOption

    system_prompt, user_prompt = build_question_gen_prompt(
        user_input, constraints, field_confidence, overall_confidence
    )

    response = create_chat_completion(
        client,
        model=get_model_name(),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=1000,
    )

    raw = _strip_fences(response.choices[0].message.content or "")

    try:
        data = json.loads(raw)
        questions_raw = data.get("questions", [])
        questions = []
        for q in questions_raw[:3]:  # hard cap at 3
            options = [QuestionOption(**o) for o in q.get("options", [])]
            questions.append(ClarificationQuestion(
                id=q["id"],
                field=q["field"],
                question=q["question"],
                options=options,
                allow_freetext=q.get("allow_freetext", True),
                hint=q.get("hint"),
            ))
        return questions
    except Exception:
        return []  # fail silently — proceed without questions


def _merge_answers(client, user_input: str, existing_constraints, answers: dict) -> dict:
    """Merge user's clarification answers into the final constraints object."""
    system_prompt, user_prompt = build_merge_prompt(
        user_input,
        existing_constraints.model_dump() if hasattr(existing_constraints, "model_dump")
        else existing_constraints,
        answers,
    )

    response = create_chat_completion(
        client,
        model=get_model_name(),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.1,
        max_tokens=800,
    )

    raw = _strip_fences(response.choices[0].message.content or "")

    try:
        data = json.loads(raw)
        # Handle both {"constraints": {...}} and bare {...}
        if "constraints" in data:
            data = data["constraints"]
        constraints = Constraints(**data)
    except Exception:
        # Fall back to existing constraints if merge fails
        constraints = existing_constraints

    return {
        "constraints": constraints,
        "clarification_questions": [],
        "clarification_answers": {},
        "current_agent": "design",
        "error": None,
    }


def _coerce_constraints(data: dict) -> Constraints:
    """Best-effort Constraints construction — drops invalid fields."""
    valid_fields = Constraints.model_fields.keys()
    cleaned = {k: v for k, v in data.items() if k in valid_fields}
    try:
        return Constraints(**cleaned)
    except Exception:
        return Constraints()


def _strip_fences(text: str) -> str:
    if text.startswith("```"):
        lines = text.splitlines()
        return "\n".join(l for l in lines if not l.strip().startswith("```")).strip()
    return text.strip()