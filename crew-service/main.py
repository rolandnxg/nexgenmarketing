"""FastAPI sidecar that turns a dashboard chat message into a CrewAI run.

Contract mirrors the dashboard's existing /api/ai-chat: it accepts
{ message, image, history, context } and returns { answer }. The Node app
(server.js) proxies to this service; the browser chat panel is unchanged.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

import crew as crewmod

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("crew-service")

app = FastAPI(title="MarketIQ Crew Service")


class ChatRequest(BaseModel):
    message: str
    image: dict[str, Any] | None = None
    history: list[dict[str, Any]] = []
    context: dict[str, Any] = {}


@app.on_event("startup")
def _startup() -> None:
    # Build agents eagerly so the first chat request isn't slowed by setup.
    try:
        crewmod.warmup()
        log.info("Crew warmed up: manager + %d specialists", len(crewmod.SPECIALIST_FOLDERS))
    except Exception:  # never block startup on warmup failure
        log.exception("Crew warmup failed; will retry lazily on first request")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _format_context(ctx: dict[str, Any]) -> str:
    """Render the dashboard's on-screen data block — mirrors server.js sections."""
    if not ctx:
        return ""
    sections: list[str] = []

    def add(label: str, value: Any) -> None:
        if value:
            sections.append(f"\n### {label}\n{json.dumps(value, indent=2, default=str)}")

    if ctx.get("platform"):
        sections.append(f"Current section: {ctx['platform']}")
    if ctx.get("dateRange"):
        sections.append(f"Date range: {ctx['dateRange']}")
    if ctx.get("kpis"):
        kpis = ctx["kpis"]
        joined = "\n".join(kpis) if isinstance(kpis, list) else str(kpis)
        sections.append(f"\n### On-screen KPIs\n{joined}")
    if ctx.get("tableData"):
        add(ctx.get("tableTitle") or "Campaign / Data Table", ctx["tableData"])

    add("Facebook Ads Totals", ctx.get("facebookTotals"))
    add("Facebook Campaigns (all loaded)", ctx.get("facebookCampaigns"))
    add("Google Ads Totals", ctx.get("googleAdsTotals"))
    add("Google Ads Campaigns (all loaded)", ctx.get("googleAdsCampaigns"))
    add("Google Analytics Totals", ctx.get("googleAnalyticsTotals"))
    add("GA4 Traffic by Channel", ctx.get("gaChannels"))
    add("Bark Totals", ctx.get("barkTotals"))
    add("MVF Totals", ctx.get("mvfTotals"))

    report = ctx.get("externalAgentReport") or ctx.get("agentReport")
    if report:
        sections.append(f"\n### External Agent Report\n{report}")

    if not sections:
        return ""
    return "\n\n---\n## Live Dashboard Data\n" + "\n".join(sections)


def _format_history(history: list[dict[str, Any]]) -> str:
    turns = (history or [])[-10:]
    if not turns:
        return ""
    lines = []
    for t in turns:
        role = t.get("role", "user")
        content = t.get("content", "")
        if isinstance(content, list):  # vision-style content array → take text parts
            content = " ".join(p.get("text", "") for p in content if isinstance(p, dict))
        lines.append(f"{role}: {content}")
    return "\n## Recent conversation (most recent last)\n" + "\n".join(lines)


def _build_task_description(req: ChatRequest) -> str:
    parts = [
        "You are the conversational AI assistant in the Nexgen MarketIQ dashboard, "
        "chatting with a marketing team member. Hold a normal conversation: match "
        "your answer to what was actually asked, and to its length.\n"
        "- Greetings, small talk, clarifying or meta questions (e.g. 'hi', 'what can "
        "you do?', 'thanks'): reply directly in 1-3 sentences. Do NOT delegate, do "
        "NOT pull data, do NOT add disclaimers or tables.\n"
        "- Simple factual questions you can answer from the conversation or the "
        "on-screen data below: answer briefly and directly.\n"
        "- Only when the user genuinely asks for analysis, performance, numbers, or "
        "recommendations should you delegate to specialists and pull live data. Even "
        "then, lead with a short direct answer; add tables/disclaimers only if they "
        "serve the question. Never fabricate numbers.\n"
        "Default to concise and conversational. A full report is the exception, not "
        "the rule — produce one only when asked for depth.",
        f"\n## User message\n{req.message}",
    ]
    hist = _format_history(req.history)
    if hist:
        parts.append(hist)
    ctx = _format_context(req.context)
    if ctx:
        parts.append(ctx)
    if req.image:
        parts.append(
            "\n## Note\nThe user attached an image. This assistant cannot view images "
            "yet — if answering depends on the image, say so and ask them to describe it."
        )
    return "\n".join(parts)


def _run_crew(req: ChatRequest) -> str:
    crew = crewmod.build_chat_crew(_build_task_description(req))
    result = crew.kickoff()
    # CrewOutput → prefer .raw; fall back to str()
    return getattr(result, "raw", None) or str(result)


@app.post("/chat")
async def chat(req: ChatRequest) -> dict[str, str]:
    answer = await run_in_threadpool(_run_crew, req)
    return {"answer": answer}
