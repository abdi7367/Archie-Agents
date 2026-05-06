import json
import os
from pathlib import Path

from groq import Client

from backend.prompts.requirements import REQUIREMENTS_SYSTEM_PROMPT
from backend.state import ArchieState


def _load_groq_api_key() -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if api_key:
        return api_key

    # Fall back to backend/.env when running locally.
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
        "Missing GROQ_API_KEY. Set it in your environment or add GROQ_API_KEY=... to backend/.env."
    )


client = Client(api_key=_load_groq_api_key())

def requirements_agent(state: ArchieState) -> dict:
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": REQUIREMENTS_SYSTEM_PROMPT},
            {"role": "user", "content": state["user_input"]}
        ],
        temperature=0.3,
        max_tokens=1000,
    )
    raw_json = response.choices[0].message.content
    return json.loads(raw_json) if raw_json else {}