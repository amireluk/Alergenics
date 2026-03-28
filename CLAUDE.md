# Alergenics — Claude Code Guide

## Project Overview

**Alergenics** is a mobile-first web app for managing systematic allergen exposure tracking. It was originally developed with the Gemini CLI and is now maintained with Claude Code.

Users track allergens from the Israel Ministry of Health list (plus custom entries), and the app surfaces which exposures are due today, tomorrow, or in the future. Trackers can be shared between users via a tracker ID — no login required.

## Open TODOs

- **CORS is set to `*` (wildcard) — must be locked down before going live.** Replace with the actual frontend hosting domain in Azure Portal → alergenics-api → API → CORS, or via: `az functionapp cors add --name alergenics-api --resource-group alergenics-rg --allowed-origins "https://your-domain.com"`

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS — single-page app in `frontend/`
- **Backend:** Azure Functions (Node.js v4 programming model) in `backend/`
- **Database:** Azure Cosmos DB (NoSQL, free tier: 1000 RU/s, 25GB)
- **Auth:** Managed Identity (Function App → Cosmos DB, no connection strings in production)
- **Language:** Hebrew UI (RTL), English code
- **No user auth:** Tracker ID is the sole access token

## Project Structure

```
index.html                           # App shell with tracker landing, agenda, settings views
script.js                            # All app logic, API calls via fetch()
style.css                            # Styles
env.js.example                       # Template — copy to env.js with your Azure Functions URL
backend/                             # Azure Functions API
  src/functions/trackers.js           # All endpoints — trackers CRUD, validation, rate limiting
  host.json                          # Azure Functions host config
  package.json                       # Dependencies
  local.settings.json.example       # Template — copy to local.settings.json for local dev
  .funcignore                        # Files excluded from deploy
```

## Secrets Policy

**No secrets are ever committed to git.** The `.gitignore` blocks:
- `backend/local.settings.json` (local dev connection string)
- `env.js` (API URL)
- Root `.env`

In production: Managed Identity — no secrets at all. The Function App authenticates to Cosmos DB via Azure AD.

## API

Three endpoints, no auth headers:

```
POST   /api/trackers           → create tracker, return 6-char ID
GET    /api/trackers/:id       → return tracker data
PUT    /api/trackers/:id       → update tracker data (validated)
```

Protection: rate limiting (5 creates/hr, 30 req/min), payload validation, 10KB size cap, no list endpoint.

## Documentation

- [app-spec.md](app-spec.md) — core feature spec
- [prd.md](prd.md) — product requirements
- [user-stories.md](user-stories.md) — user-facing requirements
- [plan.md](plan.md) — development roadmap
- [ui-plan.md](ui-plan.md) — UI layout
- [shared-boards-requirements.md](shared-boards-requirements.md) — shared trackers requirements
- [shared-boards-design.md](shared-boards-design.md) — architecture decision (Azure Functions + Cosmos DB chosen)

## App Views

Three views (bottom-nav driven, no routing library):
1. **Tracker Landing** — Create tracker / Join with tracker ID
2. **מה אוכלים היום?** — Agenda (Today / Tomorrow / Future sections)
3. **הגדרות** — Settings (allergen grid, per-item cadence controls)

## Testing

### UI / E2E tests (Playwright)

Tests live in `tests/app.spec.js`. They spin up a local static server and mock all API calls — fully offline.

```bash
npx playwright test               # run all UI tests
npx playwright test --ui          # interactive UI mode
```

### API integration tests

Tests live in `tests/api.test.js`. They hit the **live** Azure Functions API — no mocks, no framework.

```bash
node tests/api.test.js
```

On first run a test tracker is created and its ID is cached in `/tmp/alergenics-test-tracker-id` so subsequent runs reuse it. The tracker is reset to empty at the end of every run (cleanup test).

To use a specific tracker ID:
```bash
TEST_TRACKER_ID=abc123 node tests/api.test.js
```

## Debug Mode

Append `?dev` to the URL to enable debug controls (time-travel day+/day- buttons).
