# UI Plan - Alergenics

The app features a single-page agenda with a dedicated settings layer, simplified for mobile use.

**מה אוכלים היום? (Main View)**
*   **Three Sections:** 
    1. **היום (Today):** Overdue items and items due today. Completed items stay here with a ✅.
    2. **מחר (Tomorrow):** Items due exactly tomorrow.
    3. **בהמשך (Future):** All other future items.
*   **Item Cards:** Display name + emoji + status.
*   **Dynamic Buttons:** "Done" for pending items; "Undo" for items completed today.
*   **Bottom Nav:** A single prominent "Settings" (הגדרות) button.

**הגדרות (Settings View)**
*   **Grid selection:** Buttons to track/untrack allergens.
*   **Cadence:** Per-item +/- controls.
*   **Accept Button:** Large "סיום" button at the bottom to save and return.

**Interaction:**
*   **Click Feedback:** Buttons animate down/up on tap.
*   **Audio:** Subtle "click" sound on every interaction.
*   **Back Button:** Android/Browser back button returns to the agenda.
