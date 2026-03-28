# Roadmap - Alergenics

1. **HTML.** Build the dual-view structure (Agenda and Settings), RTL support, and Bottom Nav.
2. **CSS.** Create a clean card-based UI, allergen button grid, and status styling.
3. **Backend.** Azure Functions (Node.js v4) with Cosmos DB. Managed Identity for auth — no secrets in code.
4. **Security.** Rate limiting (5 creates/hr, 30 req/min), payload validation, 10KB size cap, CORS lockdown.
5. **View Management.** Handle transitions between Landing, Agenda, and Settings views.
6. **Allergen Grid.** Display buttons with emojis, tracking toggles, row/grid layout switch.
7. **Status Logic.** Display relative text (Today, in X days...) with Today/Tomorrow/Future sections.
8. **Advanced Interactions.** Per-item cadence controls (+/-), in-place Undo, drag-and-drop.
9. **Sharing.** Tracker create/join flow, invite links (?join=), 30s polling sync between clients.
10. **Testing.** Playwright E2E tests (mocked API) and live API integration tests.
