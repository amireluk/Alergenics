# PRD (Product Requirements Document) - Alergenics

**Goal:** Provide a simple interface to manage and track systematic exposure or testing of allergens based on a master list (Israel MoH) and custom entries.

**Core Concept:**
- The app operates on a "Track/Untrack" model from a master list.
- Users choose which allergens to track.
- Tracked allergens appear in "What's on the Menu" with their current status.

**Rules:**
* Strict time units: days, weeks, months.
* The app works in the web browser with Azure Functions + Cosmos DB for cloud synchronization.
* No user authentication — tracker ID is the sole access token.
* Data is persisted via the API (source of truth) with 30s polling sync between clients.
* Status is purely relative (today, in X days, overdue).
* Session-based Undo allows reverting "Done" or "Untrack" actions.
* Security is enforced via rate limiting, payload validation, and CORS restrictions.
