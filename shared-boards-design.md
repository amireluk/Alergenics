# Shared Boards -- Design Alternatives

This document compares three architectural options for implementing the Shared Boards feature in Alergenics. Each option is evaluated on architecture, security, deployment, cost, and trade-offs.

---

## Option 1: Cloudflare Workers + KV

### Architecture Overview

A single JavaScript file deployed as a Cloudflare Worker. Cloudflare KV (key-value store) holds board data as JSON blobs, keyed by board ID. The frontend communicates with the Worker via plain `fetch()` calls. No SDKs, no Firebase, no containers.

### How It Works

- The Worker handles `POST /api/boards`, `GET /api/boards/:id`, and `PUT /api/boards/:id`.
- On `POST`, the Worker generates a 6-character alphanumeric board ID server-side using nanoid, creates an empty JSON blob in KV, and returns the ID.
- On `GET`, the Worker reads the JSON blob from KV by key and returns it.
- On `PUT`, the Worker validates the incoming JSON payload (structure and size) and writes it to KV, replacing the previous value.
- The frontend is pure `fetch()` -- zero SDKs, zero libraries for the network layer.

### Security Model

- **Rate limiting:** Cloudflare provides built-in rate limiting rules, configurable in the dashboard. Free tier includes basic rate limiting.
- **No credentials in the browser:** The Worker holds the KV binding internally. The frontend only knows the Worker's public URL.
- **Payload validation:** The Worker code validates payload structure (allergens array with name/cadence/lastDone) and enforces a 10KB size cap before writing to KV.
- **No list endpoint:** The Worker only responds to requests with a specific board ID. There is no endpoint to enumerate keys.
- **Unguessable board IDs:** 6-char alphanumeric IDs generated server-side with a cryptographically suitable random source.
- **Hard caps as safety net:** Cloudflare's free tier enforces hard limits (100K reads/day, 1K writes/day). Even if rate limiting is misconfigured, these caps prevent runaway abuse.

### Deployment

```
npm install -g wrangler
wrangler login
wrangler deploy
```

One command to deploy after initial setup. The Worker is a single JS file. Configuration lives in a `wrangler.toml` file specifying the KV namespace binding.

### Cost

Free tier covers:

- 100,000 Worker requests/day
- 100,000 KV reads/day
- 1,000 KV writes/day

This is more than sufficient for Alergenics. A board with two users refreshing every 30 seconds generates roughly 5,760 reads/day and a handful of writes. Even with dozens of active boards, the free tier is not a concern.

### Pros

- Absolute minimum complexity. The entire backend is one JavaScript file.
- Zero cold starts. Workers run on Cloudflare's edge network and are always warm.
- Built-in rate limiting. No need to implement or maintain rate limiting logic in application code.
- Generous free tier. The usage pattern of this app will never approach the limits.
- Global edge deployment. Requests are served from the nearest Cloudflare PoP, typically under 20ms latency.

### Cons

- Requires a Cloudflare account, which is separate from the existing Google Cloud / Firebase setup.
- KV is eventually consistent. In the rare edge case where two users write at the exact same moment, the last write wins and one user's changes are lost. For this app's usage pattern (low-frequency updates, non-critical data), this is acceptable.
- KV is a flat key-value store. If the data model evolves to require queries, indexes, or relational structures, KV becomes limiting. A migration to a different storage layer would be needed.

---

## Option 2: Google Cloud Run + Firestore

### Architecture Overview

A small Express.js application packaged in a Docker container, deployed on Google Cloud Run. Firestore stores board documents under a `boards` collection. Service account credentials remain server-side in the container environment. The frontend communicates via plain `fetch()`.

### How It Works

- The Express app handles `POST /api/boards`, `GET /api/boards/:id`, and `PUT /api/boards/:id`.
- On `POST`, the app generates a 6-character board ID using nanoid, creates a document in Firestore at `boards/{boardId}`, and returns the ID.
- On `GET`, the app reads the Firestore document by ID and returns it as JSON.
- On `PUT`, the app validates the incoming payload and writes it to the Firestore document.
- Rate limiting is handled by `express-rate-limit` middleware (in-memory store).
- The frontend is pure `fetch()`. The Firebase JS SDK can be dropped entirely from the client, since all Firestore access goes through the Cloud Run backend.

### Security Model

- **Rate limiting:** Implemented in application code via `express-rate-limit`. Uses in-memory storage, which works fine at this scale but resets when the container restarts or Cloud Run scales to a new instance. For production-grade rate limiting, Cloud Armor can be added in front of Cloud Run (paid service).
- **No credentials in the browser:** Firestore is accessed via a service account bound to the Cloud Run service. The frontend never sees any credentials.
- **Payload validation:** Express middleware validates payload structure and enforces the 10KB size cap before writing to Firestore.
- **No list endpoint:** The Express app only exposes single-document operations by board ID.
- **Unguessable board IDs:** Same as Option 1.

### Deployment

```
gcloud run deploy alergenics-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

Requires a Dockerfile (or buildpack support), the `gcloud` CLI installed and authenticated, and a Google Cloud project with Cloud Run and Firestore APIs enabled. More setup ceremony than Cloudflare, but straightforward for someone already using Firebase.

### Cost

Free tier covers:

- 2 million Cloud Run requests/month
- 360,000 GB-seconds of compute/month
- Firestore: 50,000 reads/day, 20,000 writes/day

Well within the usage pattern of this app. Setting `min-instances: 1` to avoid cold starts would consume the free tier compute allocation faster, but at this scale it would likely remain free.

### Pros

- Stays in the Google ecosystem. The user already has a Firebase/Google Cloud project. No additional account needed.
- Firestore is a proper document database. If the data model evolves (e.g., adding board metadata, user preferences, history), Firestore handles it naturally.
- Can reuse existing Firestore data if migrating from the current client-side Firebase setup.
- Familiar tooling for anyone already using `gcloud` or Firebase CLI.

### Cons

- Cold starts. Cloud Run scales to zero by default. After a period of inactivity, the first request incurs a 1-2 second delay while a new container spins up. This can be avoided by setting `min-instances: 1`, but that consumes compute quota continuously.
- Rate limiting is DIY. The `express-rate-limit` middleware works but is not robust against container restarts or multi-instance scaling. True rate limiting requires Cloud Armor (paid).
- More deployment ceremony. Requires a Dockerfile, correct IAM permissions, and familiarity with `gcloud` CLI.
- Slightly more complex than a single-file Worker. The Express app, Dockerfile, and Firestore client library add moving parts.

---

## Option 3: Client-Only (Firebase from Browser)

### Architecture Overview

Keep the current architecture. The Firebase JS SDK in the browser talks directly to Firestore. Shared boards are implemented by creating board documents with generated board IDs. Users read and write board documents directly from the client. No backend at all.

### How It Works

- The frontend generates a board ID (or calls a Firebase Cloud Function to generate one server-side).
- A board document is created in Firestore at `boards/{boardId}`.
- The board ID is shared out of band.
- The second user enters the board ID. The frontend reads the document directly from Firestore using the Firebase JS SDK.
- Both users read and write the same Firestore document from their browsers.
- The Firebase API key remains in the HTML source. This is by design -- Firebase API keys are project identifiers, not secrets.

### Security Model -- The Problem

This is where Option 3 breaks down.

- **Without authentication:** Firestore Security Rules must allow read/write access to the `boards` collection for unauthenticated users. This means anyone who knows the Firebase project ID and API key (both visible in the HTML source code) can read, write, or delete any document in the collection. The "unguessable board ID" provides some obscurity, but the entire `boards` collection is open to programmatic enumeration or bulk deletion by anyone who inspects the page source.

- **With authentication:** Firebase Auth could restrict access, but this contradicts the core requirement of no login, no accounts, no passwords. Anonymous auth is an option, but it does not meaningfully restrict access -- any client can create an anonymous session.

- **App Check:** Firebase App Check can attest that requests come from the legitimate app, but it can be bypassed by a motivated attacker who extracts the attestation token or uses a debug token.

- **Rate limiting:** Firestore has no built-in per-client rate limiting. A malicious client can send thousands of requests per second directly to Firestore.

- **Payload validation:** Firestore Security Rules can validate document structure, but the rule language is limited and verbose. Complex validation (e.g., array element structure, string format checks) becomes unwieldy.

**In summary:** Without authentication, the Firestore database is effectively open to anyone. The API key and project ID in the source code give any attacker a direct path to the data.

### Deployment

```
firebase deploy
```

Simplest deployment of all three options. No containers, no separate services, no additional accounts.

### Cost

Firebase free tier covers:

- 50,000 Firestore reads/day
- 20,000 Firestore writes/day
- No compute costs (no backend)

### Pros

- Simplest deployment. One command, no backend to maintain.
- No additional accounts or services. Everything stays in the existing Firebase project.
- Firebase real-time sync is available if wanted later (`onSnapshot` for live updates).
- The current app is already partially built on this architecture.

### Cons

- **Cannot satisfy both "no auth" and "secure DB."** This is the fundamental blocker. Without authentication, Firestore Security Rules cannot meaningfully restrict access. With authentication, the "no login" requirement is violated.
- The Firebase API key and project ID in the source code point any attacker directly to the database.
- Without authentication, Firestore rules must be permissive, meaning anyone can read, write, or delete any document.
- No server-side payload validation. Firestore rules can do basic structural checks, but they are limited in expressiveness and awkward to maintain.
- No rate limiting. A single malicious client can overwhelm the database.
- If rules are left open, the entire `boards` collection (and potentially other collections) is exposed to bulk reads, writes, and deletes.
- The only mitigation (App Check) is bypassable by a motivated attacker.

---

## Decisions

**Option 3 (client-only Firebase) was rejected** — cannot meet security requirements without auth, which contradicts the no-login requirement.

**Option 2 (Cloud Run + Firestore) was rejected** — GCP requires a billing account even for free-tier compute (Cloud Run, Cloud Functions, Blaze plan).

**Option 1 (Cloudflare Workers + KV) remains viable** — but requires a separate Cloudflare account.

## Decision: Option 4 — Azure Functions + Cosmos DB

Since a billing account already exists on Azure, the backend was moved there. Azure Functions provides the same thin API layer, and Azure Cosmos DB (free tier: 1000 RU/s, 25GB, permanently free) replaces Firestore as the database.

### Architecture

```
Browser (fetch)  →  Azure Functions (Node.js API)  →  Azure Cosmos DB
```

- **Azure Functions:** Serverless Node.js functions, no Docker, no containers. Consumption plan = pay only for executions (free tier: 1M executions/month).
- **Cosmos DB:** NoSQL document database. Free tier: 1000 RU/s throughput, 25GB storage — genuinely free forever, no overage charges on the free tier.
- **Frontend:** Static HTML/CSS/JS. Pure `fetch()` calls to the Azure Functions URL. Zero SDKs.

### Why Azure over the other options

| Concern | GCP (Cloud Run / Cloud Functions) | Azure Functions + Cosmos DB |
|---|---|---|
| Billing account | Required (even for free tier) | Already exists |
| Docker/containers | Cloud Run needs Dockerfile | Not needed |
| Free tier storage | Firestore 50K reads/day | Cosmos DB 1000 RU/s + 25GB |
| Free tier compute | 2M req/month | 1M executions/month |
| Deploy complexity | gcloud CLI + Dockerfile | `func azure functionapp publish` |

### Security model

Identical to all backend options:

- Cosmos DB connection string stays server-side in Azure Function App Settings (environment variables managed by Azure, never in code)
- No credentials in the browser
- Rate limiting in function code
- Payload validation + size cap
- Unguessable board IDs
- No list/enumerate endpoint

## Critical Requirement: No Secrets in Git

All credentials, API keys, and connection strings must be excluded from version control:

- **Backend:** Cosmos DB connection string is stored in Azure Function App Settings (injected as environment variable at runtime). A `local.settings.json.example` documents required variables with placeholders. The actual `local.settings.json` is gitignored.
- **Frontend:** The API URL is loaded from `env.js`, which is gitignored. An `env.js.example` file documents the expected format.
- **`.gitignore`** explicitly blocks: `local.settings.json`, `frontend/env.js`, `.env`.

---

## Comparison Table

| Criteria | Cloudflare Workers + KV | Cloud Run + Firestore | Azure Functions + Cosmos DB | Client-Only (Firebase) |
|---|---|---|---|---|
| Auth required | No | No | No | Yes (to be secure) |
| Cold starts | None | 1-2s after idle | ~1-2s after idle | None |
| Rate limiting | Built-in | DIY (in-code) | DIY (in-code) | None |
| Credentials in browser | None | None | None | API key (public by design) |
| Payload validation | Server-side | Server-side | Server-side | Firestore rules (limited) |
| Deploy complexity | Low (one file) | Medium (Dockerfile) | Low (CLI publish) | Lowest (firebase deploy) |
| Additional account | Cloudflare (free) | None (but needs billing) | None (existing account) | None |
| Meets security reqs | Yes | Yes | Yes | No (without auth) |
| **Chosen** | No | No | **Yes** | No |
