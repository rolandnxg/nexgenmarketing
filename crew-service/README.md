# MarketIQ Crew Service

A Python **FastAPI sidecar** that backs the dashboard's AI chat panel with a
**CrewAI** multi-agent crew. It replaces the old single-shot OpenAI call in
`server.js` while keeping the exact same `/api/ai-chat` request/response contract,
so the browser chat panel is unchanged.

The five agents are modeled on the Claude Code subagents in the `Marketing/`
workspace (reference only — nothing there is modified).

## How it fits together

```
Browser chat panel
   │ POST /api/ai-chat { message, image, history, context }
   ▼
Node server.js ──proxy──► crew-service POST /chat ──► CrewAI hierarchical crew
   ▲                                                     manager: cmo_strategist
   └──◄ /api/gads/* /api/ga/* (CrewAI tools call back) ──┘ workers: meta_ads,
                                                            google_ads,
                                                            keyword_research,
                                                            analytics
```

- **Routing:** `cmo_strategist` is the hierarchical **manager** — it reads each
  message, delegates to the right specialist(s), and synthesizes the answer.
- **LLM:** OpenAI GPT-4.1 (reuses `OPENAI_API_KEY`); configurable via `OPENAI_MODEL`.
- **Data:** CrewAI tools in `tools/dashboard_tools.py` call the dashboard's own
  Node endpoints (`DASHBOARD_API_URL`) for live Google Ads / GA4 data. Facebook/Meta
  and Bark/MVF data ride along in the chat `context` payload.
- **Fallback:** if this service is down, `server.js` falls back to a direct OpenAI
  call so chat keeps working.

## Layout

```
crew-service/
  main.py                 FastAPI app: POST /chat, GET /health
  crew.py                 builds the hierarchical crew from crews/
  llm.py                  OpenAI LLM factory
  tools/dashboard_tools.py CrewAI tools → dashboard Node endpoints
  crews/<agent>/
    agent.yaml            role / goal / backstory + manager/delegation flags
    skills.yaml           the agent's allow-listed skill names
  skills/<name>/SKILL.md  methodology, copied from Marketing/.claude/skills
```

Each agent's allow-listed skills are loaded from `skills/<name>/SKILL.md` and
injected into its backstory as condensed methodology references ("skills as static
knowledge"). This is deterministic and uses no vector store/embeddings. Upgrading to
CrewAI's RAG `Knowledge` sources is a possible later enhancement.

## Run

Via docker-compose from the dashboard root (recommended):

```bash
docker compose up --build
```

Standalone (needs `OPENAI_API_KEY` and a reachable `DASHBOARD_API_URL`):

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Endpoints

- `POST /chat` — body `{ message, image?, history?, context? }` → `{ answer }`
- `GET /health` — `{ "status": "ok" }`

## Guardrails carried over from the Marketing agents

Meta is lead-gen (CPA/cost-per-lead, never ROAS); Google Ads conversion tracking is
known-unreliable (flag, don't interpret); Google Ads breakdowns follow
Account → Campaign → Ad Groups → Ads; never fabricate numbers; always include the
attribution disclaimer when conversions are involved.
