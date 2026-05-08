"""Prompt builder for the Design Agent.

The user prompt injects the validated constraints so the model reasons
against this specific project — not generic best practices.

Mermaid diagrams are requested as graph TD strings so the frontend
can render them directly without any server-side processing.
"""

import json
from backend.state import Constraints


DESIGN_SYSTEM_PROMPT = """\
You are the Design Agent for Archie, an AI architecture advisor.

Your job is to generate exactly 3 architecture options for the given project:
  1. MVP           — optimized for shipping fast with minimal ops overhead
  2. Production    — handles the stated load reliably with good observability
  3. Future-scale  — handles 10x the stated load, horizontally scalable

Rules:
- Every decision must be justified by the actual constraints provided.
- Do NOT recommend what a large team can't operate (e.g. don't suggest
  Kubernetes for a team of 2-3 unless scale absolutely demands it).
- Do NOT recommend what the budget can't support.
- Each architecture must be meaningfully different — not just the same
  stack with "add Redis" between tiers.
- Mermaid diagrams must be valid graph TD syntax. Use short node IDs.
  No parentheses or special characters inside node labels.
- Return ONLY valid JSON. No markdown, no backticks, no explanation.

Output schema:
{
  "architectures": [
    {
      "tier": "MVP" | "Production" | "Future-scale",
      "summary": "one sentence describing the core approach",
      "components": ["list of services/infrastructure pieces"],
      "data_flow": ["step-by-step description of how data moves"],
      "scaling_approach": "how this tier handles load",
      "observability": ["logging", "metrics", "alerting choices"],
      "security": ["key security measures"],
      "tradeoffs": {
        "pros": ["what this approach does well"],
        "cons": ["what this approach sacrifices"]
      },
      "estimated_monthly_cost": "rough $ range e.g. $800-$1200/month",
      "mermaid_diagram": "graph TD\\n  A[Client] --> B[API]\\n  ..."
    }
  ]
}"""


def build_design_prompt(constraints: Constraints) -> tuple[str, str]:
    """
    Returns (system_prompt, user_prompt).

    The user prompt injects the full constraint object so the model
    has all context in a single readable block.
    """
    constraints_block = json.dumps(constraints.model_dump(), indent=2, default=str)

    user_prompt = f"""\
Generate 3 architecture options for this project.

Project constraints:
{constraints_block}

Remember:
- Team size is {constraints.team_size} — ops complexity must match.
- Budget is {constraints.budget} — stay within realistic cloud spend.
- Compliance: {constraints.compliance or "none stated"} — apply relevant controls.
- Scale target: {constraints.scale} with {constraints.traffic_pattern} traffic pattern.

Return the JSON object with the "architectures" array. Nothing else."""

    return DESIGN_SYSTEM_PROMPT, user_prompt