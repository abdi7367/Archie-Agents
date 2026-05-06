import os
import sys
from typing import Any

if __package__ is None or __package__ == "":
    # Allow direct script execution: `python backend/main.py`
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend.state import ArchieState
from backend.agents.requirements import requirements_agent


FOLLOW_UP_QUESTIONS = [
    ("scale", "Expected scale/load (example: 100k requests/day)"),
    ("traffic_pattern", "Traffic pattern (steady | spiky | scheduled | growing)"),
    ("peak_multiplier", "Peak traffic multiplier (number, example: 3)"),
    ("team_size", "Team size (number)"),
    ("experience_level", "Team experience (junior | mid | senior | mixed)"),
    ("budget", "Monthly cloud budget (example: $10k/month)"),
    ("latency_sla", "Latency SLA (example: 100ms p95)"),
    ("stack", "Current/preferred stack (comma-separated)"),
    ("preferred_cloud", "Preferred cloud (AWS | GCP | Azure | none)"),
    ("data_sensitivity", "Data sensitivity (public | internal | PII | financial | medical)"),
    ("data_volume", "Data volume (example: 100GB/day)"),
    ("compliance", "Compliance requirements (comma-separated, example: HIPAA,SOC2)"),
    ("regions", "Deployment regions (comma-separated, example: us-east-1,eu-west-1)"),
    ("product_type", "Product type (consumer app | B2B SaaS | internal tool | data pipeline | IoT)"),
    ("growth_expectation", "Growth expectation (stable | moderate | hypergrowth)"),
]


def _stringify_default(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join(str(item) for item in value)
    return str(value)


def _parse_answer(key: str, answer: str) -> Any:
    if key in {"team_size", "peak_multiplier"}:
        try:
            return int(answer)
        except ValueError:
            try:
                return float(answer)
            except ValueError:
                return answer
    if key in {"stack", "compliance", "regions"}:
        return [item.strip() for item in answer.split(",") if item.strip()]
    return answer


def collect_follow_up_requirements(requirements: dict) -> dict:
    print("\nLet's refine requirements. Press Enter to keep suggested values.")
    for key, question in FOLLOW_UP_QUESTIONS:
        current_value = requirements.get(key)
        default_text = _stringify_default(current_value)
        prompt = f"{question}"
        if default_text:
            prompt += f" [{default_text}]"
        prompt += ": "

        answer = input(prompt).strip()
        if answer:
            requirements[key] = _parse_answer(key, answer)
        elif key not in requirements:
            requirements[key] = current_value
    return requirements


def build_initial_state(user_input: str) -> ArchieState:
    return ArchieState(
        user_input=user_input,
        constraints=None,
        current_agent="Requirements Agent",
        error=None,
    )

if __name__ == "__main__":
    input_description = input("Enter your product description: ")
    result = requirements_agent(build_initial_state(input_description))
    final_requirements = collect_follow_up_requirements(result)
    print("\nFinal gathered requirements:")
    print(final_requirements)