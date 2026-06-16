"""CrewAI tools that read live marketing data from the dashboard's own Node API.

The Node app (server.js) already exposes working, credentialed endpoints for
Google Ads and GA4. Rather than re-implement those API integrations in Python,
these tools call back into the dashboard over the internal docker network
(DASHBOARD_API_URL, default http://marketiq:3000). Facebook/Meta and Bark/MVF
data have no server-side endpoint — they arrive in the chat `context` payload —
so there is no tool for them here (phase 1).
"""

from __future__ import annotations

import json
import os

import httpx
from crewai.tools import tool

DASHBOARD_API_URL = os.getenv("DASHBOARD_API_URL", "http://marketiq:3000").rstrip("/")
_TIMEOUT = float(os.getenv("DASHBOARD_API_TIMEOUT", "30"))


def _get(path: str, params: dict) -> str:
    """GET a dashboard endpoint and return a compact JSON string (or an error note).

    Tools must always return a string so the agent can reason over the result even
    when the call fails — never raise, so a single data gap doesn't abort the crew.
    """
    url = f"{DASHBOARD_API_URL}{path}"
    try:
        resp = httpx.get(url, params=params, timeout=_TIMEOUT)
    except httpx.HTTPError as exc:
        return f"ERROR calling {path}: {exc}. The data could not be retrieved — say so; do not fabricate numbers."

    if resp.status_code != 200:
        return (
            f"ERROR: {path} returned HTTP {resp.status_code}: {resp.text[:300]}. "
            "Report what is blocked; do not fabricate numbers."
        )

    try:
        data = resp.json()
    except json.JSONDecodeError:
        return f"ERROR: {path} returned non-JSON response: {resp.text[:300]}"

    if isinstance(data, dict) and data.get("error"):
        return f"ERROR from {path}: {data['error']}. Report what is blocked; do not fabricate numbers."

    if isinstance(data, list) and not data:
        return f"No rows returned from {path} for params {params}. Treat as no data available (do not invent values)."

    return json.dumps(data, separators=(",", ":"))


def _clamp_days(days: int) -> int:
    try:
        d = int(days)
    except (TypeError, ValueError):
        return 30
    return max(1, min(d, 365))


@tool("get_google_ads_daily")
def get_google_ads_daily(days: int = 30) -> str:
    """Daily Google Ads totals (impressions, clicks, spend in AUD, conversions, revenue)
    across all Nexgen accounts for the last `days` days (default 30). Use for spend/
    click/conversion trends. Returns JSON array of daily rows, oldest first."""
    return _get("/api/gads/daily", {"days": _clamp_days(days)})


@tool("get_google_ads_campaigns")
def get_google_ads_campaigns(days: int = 30) -> str:
    """Per-campaign Google Ads performance (name, spend, revenue, impressions, clicks,
    conversions, status) across all Nexgen accounts for the last `days` days
    (default 30), sorted by spend descending. Use to find top spenders and waste."""
    return _get("/api/gads/campaigns", {"days": _clamp_days(days)})


@tool("get_ga_daily")
def get_ga_daily(days: int = 30) -> str:
    """Daily Google Analytics 4 metrics (sessions, pageviews, bounce, duration, goals)
    and traffic-by-channel for the last `days` days (default 30). Use for site
    traffic trends and channel mix. Returns an object with `daily` and `channels`."""
    return _get("/api/ga/daily", {"days": _clamp_days(days)})


@tool("get_ga_top_pages")
def get_ga_top_pages(days: int = 30) -> str:
    """Top 25 landing/content pages from GA4 (path, title, pageviews, sessions, bounce,
    avg duration) for the last `days` days (default 30). Use to see which pages draw
    traffic. Returns a JSON array sorted by pageviews descending."""
    return _get("/api/ga/pages", {"days": _clamp_days(days)})


# Tool registry keyed by name so the crew builder can attach tools per agent.
ALL_TOOLS = {
    "get_google_ads_daily": get_google_ads_daily,
    "get_google_ads_campaigns": get_google_ads_campaigns,
    "get_ga_daily": get_ga_daily,
    "get_ga_top_pages": get_ga_top_pages,
}

GADS_TOOLS = ["get_google_ads_daily", "get_google_ads_campaigns"]
GA_TOOLS = ["get_ga_daily", "get_ga_top_pages"]


def tools_for(names: list[str]) -> list:
    """Resolve a list of tool names to tool objects, ignoring unknown names."""
    return [ALL_TOOLS[n] for n in names if n in ALL_TOOLS]
