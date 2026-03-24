# PRD (Product Requirements Document) - Alergenics

**Goal:** Provide a simple interface to manage and track systematic exposure or testing of allergens based on a master list (Israel MoH) and custom entries.

**Core Concept:**
- The app operates on a "Track/Untrack" model from a master list.
- Users choose which allergens to track.
- Tracked allergens appear in "Whats on the Menu" with their current status.

**Rules:**
* Strict time units: days, weeks, months.
* The app works entirely in the web browser (no login required for now).
* Data is persisted via `localStorage`.
* Status is purely relative (today, in X days, overdue).
* Session-based Undo allows reverting "Done" or "Untrack" actions.
