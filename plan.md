# Roadmap - Alergenics

1. **Step 1: HTML.** Build the dual-view structure (Agenda and Management), RTL support, and Bottom Nav.
2. **Step 2: CSS.** Create a clean card-based UI, allergen button grid, and status styling.
3. **Step 3: Firebase Integration.** Configure Firebase (Authentication, Firestore, App Check) and replace `localStorage` with a robust cloud-synced state.
4. **Step 4: Authentication & Security.** Implement Google/Email login and enforce security via:
    - **Firestore Security Rules:** Restricted read/write access per user UID.
    - **Domain Whitelisting:** Only authorized URLs can interact with the API.
    - **App Check:** App attestation to prevent unauthorized client traffic.
    - **CORS:** Configuration for web origins and cross-domain requests.
5. **Step 5: View Management.** Handle transitions between the Agenda, Management, and Login pages.
6. **Step 6: Allergen Grid.** Display buttons with emojis and tracking toggles.
7. **Step 7: Status Logic.** Display relative text (Today, in X days...) and the Future divider.
8. **Step 8: Advanced Interactions.** Per-item cadence controls (+/-) and in-place Undo functionality.
9. **Step 9: Testing & Security Audit.** Verify sorting, data persistence, and security (App Check, Rules).
