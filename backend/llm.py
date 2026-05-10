"""
backend/llm.py

Unified LLM client factory.
  INFERENCE_MODE=groq   → Groq cloud API (default, local dev)
  INFERENCE_MODE=local  → vLLM on AMD ROCm (production/demo)

Switching modes requires only changing the env var and restarting.
The agents never import Groq or OpenAI directly — only this module.
"""

import os
from functools import lru_cache
from pathlib import Path


def _load_env_var(key: str) -> str | None:
    val = os.getenv(key)
    if val:
        return val
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            k, v = stripped.split("=", 1)
            if k.strip() == key:
                os.environ[key] = v.strip()
                return v.strip()
    return None


def get_inference_mode() -> str:
    return (_load_env_var("INFERENCE_MODE") or "groq").lower()


def get_model_name() -> str:
    mode = get_inference_mode()
    if mode == "local":
        # vLLM serves whatever model you loaded — configurable
        return _load_env_var("LOCAL_MODEL_NAME") or "meta-llama/Llama-3.3-70B-Instruct"
    return "llama-3.3-70b-versatile"   # Groq model ID


@lru_cache(maxsize=1)
def get_client():
    """
    Returns a client with an OpenAI-compatible interface.
    Both Groq and vLLM expose the same /v1/chat/completions contract.
    """
    mode = get_inference_mode()

    if mode == "local":
        # vLLM exposes OpenAI-compatible API
        from openai import OpenAI
        base_url = _load_env_var("VLLM_BASE_URL") or "http://localhost:8000/v1"
        return OpenAI(
            base_url=base_url,
            api_key="not-needed",   # vLLM doesn't require auth by default
        )

    # Default: Groq
    api_key = _load_env_var("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Missing GROQ_API_KEY. Set it in your environment or backend/.env"
        )
    from groq import Client
    return Client(api_key=api_key)