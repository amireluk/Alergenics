# Shared Trackers — Architecture Decision

## Decision: Azure Functions + Cosmos DB

After evaluating Cloudflare Workers + KV, GCP Cloud Run + Firestore, client-only Firebase, and Azure Functions + Cosmos DB, **Option 4 was chosen**.

## Why Azure

- User already had an Azure billing account (GCP required new billing setup even for free tier)
- Cosmos DB free tier: 1000 RU/s, 25GB — sufficient for this app
- Managed Identity: Function App authenticates to Cosmos DB via Azure AD — no connection strings in production
- Azure Functions Node.js v4 programming model — clean, minimal code

## Architecture

```
Browser (vanilla JS)
  → fetch() → Azure Functions (3 endpoints)
    → Cosmos DB (NoSQL, partition key: /id)
```

**Endpoints:**
- `POST /api/trackers` — create tracker, returns 6-char nanoid
- `GET /api/trackers/:id` — return allergens array
- `PUT /api/trackers/:id` — validated update

**Security:** Rate limiting (in-memory), payload validation, 10KB size cap, no list endpoint, unguessable 6-char IDs.

## Rejected Options

1. **Cloudflare Workers + KV** — good option but user had no Cloudflare account
2. **GCP Cloud Run + Firestore** — required billing account even for free tier
3. **Client-only Firebase** — API keys in browser, rules-only security too fragile for this use case
