# Technical Design - Alergenics (English Documentation)

**Tools:**
* HTML5 for page structure (RTL for UI).
* CSS3 for card-based interface, button grids, and color-coded statuses.
* JavaScript (ES6+) for state management, date arithmetic, and DOM manipulation.

**Data Storage:**
* Browser `localStorage` for data persistence.
* Storage Key: `alergenics_tasks_he`.

## 1. Architectural Overview
The app uses a dual-view architecture (Agenda and Settings). Navigation is managed via a single "Settings" button in the main view and an "Accept" button in the Settings view. Native back-button support is implemented via the History API.

### Views:
1.  **מה אוכלים היום? (Agenda):** The main landing page showing three sections:
    - **Today & Overdue:** Includes items recently marked as done today (with a checkmark).
    - **Tomorrow:** Items due exactly one day from now.
    - **Rest of the week:** All other future items.
2.  **הגדרות (Settings):** Configuration grid for tracking/untracking allergens and setting cadences.

## 2. Core Logic & Status Calculation
- **Date Comparison:** UTC-based handling, normalized to midnight.
- **Three-Way Split:**
    - `diff <= 0`: Today/Overdue.
    - `diff == 1`: Tomorrow.
    - `diff > 1`: Future.
- **Accomplishment State:** If an item's `lastDone` is the current day, it remains in the "Today" section with a ✅ icon instead of a "Done" button, providing visual feedback of completion.

## 3. Interaction & Feedback
- **Clicky Buttons:** CSS transitions using `transform: translateY(2px)` and `scale(0.98)` on active state.
- **Audio Feedback:** A subtle, short click sound played via JavaScript on every button interaction.
- **Robust Undo:** State-level history per item allows independent "Undo" actions for any item modified during the session.

## 4. Navigation Logic
- **History API:** `pushState('settings')` when opening settings. `popstate` event returns to the agenda. This ensures the Android back button works as expected.

## 5. Future Development: Multi-User Support & Cloud Sync
(See previous documentation for backend planning).
