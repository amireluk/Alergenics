# App Spec - Alergenics

**Core Function:** Manage the tracking status of allergens and monitor the next scheduled encounter or test.

**Allergen Management:**
- Users can toggle the "Track" status of allergens from the Israel Ministry of Health list via a button grid.
- Custom allergen names can be added for tracking.
- Each tracked allergen uses a set cadence (default: 3 days).

**Views:**
1. **Whats on the Menu (Agenda):** The landing page displaying all currently tracked allergens, sorted by urgency.
2. **Track Management:** A separate page/view showing all available allergens for selection.

**Tracking Logic:**
- "Tracked" items calculate their `nextDue` relative to the current moment.
- Marking an item as "Done" resets its `nextDue` based on the frequency rule.
- "Untracking" an item removes it from the agenda but keeps it available in the master list.
