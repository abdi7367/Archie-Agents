"""Prompt builder for the Requirements Agent.

The JSON schema is generated directly from the Constraints Pydantic model.
This prevents the prompt and the model from drifting out of sync when fields
are added or renamed.
"""

import json
from backend.state import Constraints


def build_requirements_prompt() -> str:
    schema = Constraints.model_json_schema()

    # Inline the enum values so the model sees allowed strings directly
    schema_str = json.dumps(schema, indent=2)

    return f"""You are the Requirements Agent for Archie, an AI architecture advisor.

Extract structured engineering constraints from the user's product description.
Use context clues to infer fields not explicitly stated. Prefer specific values
over null — make a reasonable estimate and the user will correct it.

Rules:
- Return ONLY valid JSON. No markdown, no backticks, no explanation.
- Every field in the schema must be present (use null if truly unknown).
- For list fields, return an empty array [] rather than null.
- traffic_pattern must be one of: steady, spiky, scheduled, growing
- experience_level must be one of: junior, mid, senior, mixed

JSON schema to follow:
{schema_str}"""