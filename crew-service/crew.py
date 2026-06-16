"""Builds the hierarchical CrewAI crew from the per-agent folders under crews/.

Topology (decided with the user):
  - cmo_strategist is the MANAGER (Process.hierarchical, allow_delegation=True):
    it reads each message, delegates to the right specialist(s), and synthesizes.
  - meta_ads / google_ads / keyword_research / analytics are the worker
    specialists.

Each agent's allow-listed skills (skills.yaml) are loaded from skills/<name>/SKILL.md
and injected into its backstory as condensed methodology references. This is the
"skills as static knowledge" translation from the plan — deterministic, no vector
store or embeddings. Agents and LLM are built once and reused across requests; only
the per-message Task + Crew are created per request (see build_chat_crew).
"""

from __future__ import annotations

from pathlib import Path

import yaml
from crewai import Agent, Crew, Process, Task

from llm import build_llm
from tools.dashboard_tools import GA_TOOLS, GADS_TOOLS, tools_for

BASE = Path(__file__).parent
CREWS_DIR = BASE / "crews"
SKILLS_DIR = BASE / "skills"

MANAGER_FOLDER = "cmo_strategist"
SPECIALIST_FOLDERS = ["meta_ads", "google_ads", "keyword_research", "analytics"]

# Which live-data tools each agent folder receives.
AGENT_TOOLS = {
    "cmo_strategist": [],  # orchestrates; pulls no data itself
    "meta_ads": GADS_TOOLS + GA_TOOLS,
    "google_ads": GADS_TOOLS,
    "keyword_research": GADS_TOOLS,
    "analytics": GADS_TOOLS + GA_TOOLS,
}

_SKILL_DIGEST_CHARS = 1500  # per-skill excerpt cap to keep prompts bounded


def _strip_frontmatter(text: str) -> str:
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            return text[end + 4:].lstrip()
    return text


def _load_skill_digest(name: str) -> str | None:
    """Condense a SKILL.md into description + section list + capped excerpt."""
    path = SKILLS_DIR / name / "SKILL.md"
    if not path.exists():
        return None
    raw = path.read_text(encoding="utf-8", errors="ignore")

    description = ""
    if raw.startswith("---"):
        fm_end = raw.find("\n---", 3)
        if fm_end != -1:
            try:
                meta = yaml.safe_load(raw[3:fm_end]) or {}
                description = (meta.get("description") or "").strip()
            except yaml.YAMLError:
                description = ""

    body = _strip_frontmatter(raw)
    headings = [
        ln.lstrip("#").strip()
        for ln in body.splitlines()
        if ln.startswith("#") and ln.lstrip("#").strip()
    ][:25]

    parts = [f"### Skill: {name}"]
    if description:
        parts.append(description)
    if headings:
        parts.append("Covers: " + "; ".join(headings))
    parts.append(body[:_SKILL_DIGEST_CHARS].strip())
    return "\n".join(parts)


def _build_agent(folder: str, llm) -> Agent:
    adir = CREWS_DIR / folder
    cfg = yaml.safe_load((adir / "agent.yaml").read_text(encoding="utf-8"))
    skl = yaml.safe_load((adir / "skills.yaml").read_text(encoding="utf-8")) or {}

    backstory = cfg["backstory"].rstrip()
    digests = [d for d in (_load_skill_digest(s) for s in skl.get("skills", [])) if d]
    if digests:
        backstory += (
            "\n\n## Skills you apply (methodology references)\n"
            "Use the frameworks below to ground your reasoning and recommendations; "
            "they inform method, never the numbers (numbers come only from your tools "
            "or the provided data).\n\n" + "\n\n".join(digests)
        )

    return Agent(
        role=cfg["role"].strip(),
        goal=cfg["goal"].strip(),
        backstory=backstory,
        llm=llm,
        tools=tools_for(AGENT_TOOLS.get(folder, [])),
        allow_delegation=bool(cfg.get("allow_delegation", False)),
        verbose=True,
    )


# ── Build once, reuse across requests ─────────────────────────────────────────
_LLM = None
_MANAGER: Agent | None = None
_SPECIALISTS: list[Agent] | None = None


def _components():
    global _LLM, _MANAGER, _SPECIALISTS
    if _MANAGER is None:
        _LLM = build_llm()
        _MANAGER = _build_agent(MANAGER_FOLDER, _LLM)
        _SPECIALISTS = [_build_agent(f, _LLM) for f in SPECIALIST_FOLDERS]
    return _MANAGER, _SPECIALISTS


def warmup() -> None:
    """Build agents eagerly so the first chat request isn't slowed by it."""
    _components()


def build_chat_crew(task_description: str) -> Crew:
    """Assemble a hierarchical crew for a single chat turn."""
    manager, specialists = _components()
    task = Task(
        description=task_description,
        expected_output=(
            "A conversational markdown reply whose length matches the question: a "
            "sentence or two for greetings, small talk, or simple questions; a fuller "
            "answer only when the user asks for analysis or numbers. When data is "
            "used, cite figures from tools (never fabricate) and preserve the relevant "
            "caveats (attribution disclaimer, Google tracking unreliability, Meta "
            "lead-gen/CPA) — but only include caveats and tables when they serve the "
            "question, not by default."
        ),
    )
    return Crew(
        agents=specialists,
        tasks=[task],
        process=Process.hierarchical,
        manager_agent=manager,
        memory=False,
        verbose=True,
    )
