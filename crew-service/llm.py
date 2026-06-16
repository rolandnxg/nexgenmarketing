"""LLM factory for the crew. Keeps OpenAI (GPT-4.1) as decided, reusing the
dashboard's existing OPENAI_API_KEY. CrewAI routes through LiteLLM, which reads
OPENAI_API_KEY from the environment; the `openai/` prefix makes the provider
explicit so it never gets misrouted."""

from __future__ import annotations

import os

from crewai import LLM


def build_llm() -> LLM:
    model = os.getenv("OPENAI_MODEL", "gpt-4.1")
    return LLM(
        model=f"openai/{model}",
        temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.3")),
    )
