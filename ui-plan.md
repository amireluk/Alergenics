# UI Plan - Alergenics

The app consists of two primary views within a single-page structure, managed via a bottom navigation bar.

**Whats on the Menu? (Main View)**
*   **Agenda Items:** Display name + emoji + relative status (today, in X days).
*   **Sorting:** Urgent items at the top, with a visual divider for "Future" tasks.
*   **Action Buttons:** "Done" for current/overdue items; "Undo" for items moved during the session.

**Track Management (Configuration View)**
*   **Header:** Title and Close (X) button.
*   **Custom Tracker:** Field to track an allergen not in the master list.
*   **Allergen Grid:** A grid of large buttons representing the MoH list.
    - Each button shows: Name + Emoji.
    - Color indicates tracking status (e.g., Blue for tracked).
    - Cadence controls (+/-) attached to each button to set the frequency.
*   **Finish Button:** A large button at the bottom to return to the agenda.

**Bottom Navigation**
*   **Menu:** Switch to the Agenda view.
*   **Manage:** Switch to the Track Management view.
