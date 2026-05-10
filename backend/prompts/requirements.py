"""
Cursor-style Interactive Requirement Architect for Archie.

Key upgrade:
- Moves from "question generation" → "decision engine"
- Uses urgency scoring instead of naive filtering
- Enforces hard backend rules (not just prompt reliance)
"""

import json

# ─────────────────────────────────────────────────────────────
# FIELD IMPACT MAP (unchanged but now used for scoring)
# ─────────────────────────────────────────────────────────────

FIELD_IMPACT = {
    "scale": "critical",
    "traffic_pattern": "critical",
    "team_size": "critical",
    "budget": "high",
    "compliance": "high",
    "data_sensitivity": "high",
    "preferred_cloud": "medium",
    "latency_sla": "medium",
    "experience_level": "low",
    "growth_expectation": "low",
    "product_type": "low",
}

IMPACT_SCORE = {
    "critical": 1.0,
    "high": 0.8,
    "medium": 0.5,
    "low": 0.2,
}

CONFIDENCE_THRESHOLD = 0.80
QUESTION_CONFIDENCE_CUTOFF = 0.60
MAX_QUESTIONS_PER_CYCLE = 3
MAX_TOTAL_QUESTIONS = 5


# ─────────────────────────────────────────────────────────────
# URGENCY SCORING ENGINE (NEW CORE LOGIC)
# ─────────────────────────────────────────────────────────────

def compute_field_urgency(field_confidence: list):
    """
    Returns ranked fields by urgency = impact * uncertainty
    """

    scored = []

    for f in field_confidence:
        field = f["field"]
        confidence = f.get("confidence", 0.0)

        impact_label = FIELD_IMPACT.get(field, "low")
        impact = IMPACT_SCORE[impact_label]

        urgency = impact * (1 - confidence)

        scored.append({
            "field": field,
            "confidence": confidence,
            "impact": impact_label,
            "urgency": urgency
        })

    # highest urgency first
    scored.sort(key=lambda x: x["urgency"], reverse=True)

    return scored


def select_top_questions(field_confidence, limit=3):
    """
    Cursor-style selection:
    ONLY ask what truly matters for architecture decisions.
    """

    ranked = compute_field_urgency(field_confidence)

    selected = []

    for item in ranked:
        if len(selected) >= limit:
            break

        # HARD FILTER: only high-impact uncertainty
        if item["impact"] not in ["critical", "high"]:
            continue

        if item["confidence"] >= QUESTION_CONFIDENCE_CUTOFF:
            continue

        selected.append(item)

    return selected


# ─────────────────────────────────────────────────────────────
# PHASE 1: EXTRACTION PROMPT (UPDATED RULES)
# ─────────────────────────────────────────────────────────────

EXTRACTION_SYSTEM_PROMPT = """
You are Archie Requirement Architect — a senior AI system designer acting like a CTO.

Your job is NOT just extraction — it is intelligent inference.

You must:
1. Extract constraints
2. Assign confidence per field (0.0–1.0)
3. Infer aggressively when obvious
4. Generate assumptions when needed
5. Decide readiness

CRITICAL RULE:
If a value can be reasonably inferred (≥70% certainty), DO NOT ask questions.

CONFIDENCE RULES:
- 1.0 = explicitly stated
- 0.7 = strong inference
- 0.4 = weak inference
- 0.1 = unknown

STOPPING RULE:
If overall_confidence ≥ 0.8 → mark as "ready"

OUTPUT FORMAT (STRICT JSON ONLY):

{
  "constraints": {},
  "field_confidence": [],
  "overall_confidence": 0.0,
  "assumptions": [],
  "ready": false
}
"""


# ─────────────────────────────────────────────────────────────
# PHASE 2: QUESTION GENERATION (CURSOR STYLE)
# ─────────────────────────────────────────────────────────────

QUESTION_GEN_SYSTEM_PROMPT = """
You are an AI CTO conducting a minimal, high-signal architecture interview.

Your goal:
Ask ONLY questions that materially change system design.

RULES:
- Maximum 3 questions total
- Prefer fewer questions (1–2 ideal)
- NEVER ask low-impact fields
- Each question must have selectable chips
- Always include:
    - "Not sure"
    - "Let system decide"
- Questions must feel like Cursor AI, not a form

QUESTION STYLE:
Concise, decision-oriented, architecture-impact focused.

OUTPUT FORMAT (STRICT JSON ONLY):

{
  "questions": [
    {
      "field": "scale",
      "question": "What scale are you targeting at launch?",
      "hint": "This determines system architecture tier",
      "options": [
        {"label": "Prototype (<1k users)", "value": "1k"},
        {"label": "Startup (1k–100k)", "value": "50k"},
        {"label": "Scale (100k–1M)", "value": "500k"},
        {"label": "Enterprise (1M+)", "value": "2M"},
        {"label": "Not sure", "value": "10k"},
        {"label": "Let system decide", "value": "auto"}
      ]
    }
  ]
}
"""


# ─────────────────────────────────────────────────────────────
# MERGE PROMPT (UNCHANGED BUT CLEANED)
# ─────────────────────────────────────────────────────────────

MERGE_SYSTEM_PROMPT = """
You are merging user clarification answers into system constraints.

Rules:
- User answers override inferred values
- Preserve unchanged fields
- Return complete constraints JSON only
"""


# ─────────────────────────────────────────────────────────────
# BUILDERS
# ─────────────────────────────────────────────────────────────

def build_extraction_prompt(user_input: str):
    return EXTRACTION_SYSTEM_PROMPT, user_input


def build_question_gen_prompt(
    user_input: str,
    extracted_constraints: dict,
    field_confidence: list,
    overall_confidence: float,
    questions_asked_so_far: int = 0
):
    """
    CURSOR-STYLE DECISION LAYER:
    Backend pre-selects fields so LLM doesn't hallucinate questions.
    """

    ranked = select_top_questions(field_confidence)

    # HARD STOP CONDITIONS (important)
    if overall_confidence >= CONFIDENCE_THRESHOLD:
        return None, None

    if questions_asked_so_far >= MAX_TOTAL_QUESTIONS:
        return None, None

    # limit per cycle
    ranked = ranked[:MAX_QUESTIONS_PER_CYCLE]

    user_prompt = f"""
User input:
{user_input}

Extracted constraints:
{json.dumps(extracted_constraints, indent=2)}

Overall confidence:
{overall_confidence}

Selected fields for clarification:
{json.dumps(ranked, indent=2)}

Generate ONLY questions for these fields.
Return max 3 questions.
"""

    return QUESTION_GEN_SYSTEM_PROMPT, user_prompt


def build_merge_prompt(user_input: str, existing_constraints: dict, answers: dict):
    user_prompt = f"""
User input:
{user_input}

Existing constraints:
{json.dumps(existing_constraints, indent=2)}

User answers:
{json.dumps(answers, indent=2)}

Merge answers into constraints.
Return final constraints JSON only.
"""

    return MERGE_SYSTEM_PROMPT, user_prompt