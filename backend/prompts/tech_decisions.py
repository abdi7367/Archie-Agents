"""Prompt builder for the Tech Decisions Agent."""

import json
from backend.state import Constraints


TECH_DECISIONS_SYSTEM_PROMPT = """\
You are the Tech Decisions Agent for Archie, an AI architecture advisor.

Your job is to evaluate the 3 architecture tiers and for each one produce
scored, justified technology decisions across key categories.

Rules:
- Every decision must be justified by the actual constraints — not generic best practices.
- Scores are 1-10. Be honest: a good MVP choice might score 9 for MVP but 4 for Future-scale.
- Alternatives must be real options the team could actually switch to.
- Do NOT recommend technologies the team size or budget cannot support.
- Return ONLY valid JSON. No markdown, no backticks, no explanation.

Output schema:
{
  "tech_decisions": [
    {
      "tier": "MVP" | "Production" | "Future-scale",
      "decisions": [
        {
          "category": "Database" | "Cache" | "Queue" | "API Gateway" | "Auth" |
                       "Storage" | "Search" | "Observability" | "CI/CD" | "Hosting",
          "chosen": "e.g. PostgreSQL on RDS",
          "score": 8,
          "justification": "why this fits the constraints",
          "alternatives": ["option A", "option B"],
          "when_to_switch": "condition that would make you switch away"
        }
      ],
      "overall_recommendation": "one paragraph summarising the tier's tech posture",
      "risk_flags": ["any major risks specific to this tier's choices"]
    }
  ]
}"""


def build_tech_decisions_prompt(constraints, architectures: list) -> tuple[str, str]:
    """Returns (system_prompt, user_prompt)."""
    constraints_block = json.dumps(
        constraints.model_dump(), indent=2, default=str
    )
    architectures_block = json.dumps(architectures, indent=2, default=str)

    user_prompt = f"""\
Evaluate technology decisions for each of the 3 architecture tiers below.

Project constraints:
{constraints_block}

Architecture tiers:
{architectures_block}

For each tier, score and justify decisions across the relevant categories.
Only include categories that are actually relevant to that tier's components.
Return the JSON object with the "tech_decisions" array. Nothing else."""

    return TECH_DECISIONS_SYSTEM_PROMPT, user_prompt