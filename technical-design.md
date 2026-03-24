# Technical Design - Alergenics (English Documentation)

**Tools:**
* HTML5 for page structure (RTL for UI).
* CSS3 for card-based interface, button grids, and color-coded statuses.
* JavaScript (ES6+) for state management, date arithmetic, and DOM manipulation.

**Data Storage:**
* Browser `localStorage` for data persistence.
* Storage Key: `alergenics_tasks_he`.

**Data Model:**
```json
{
  "id": 1711286400000,
  "name": "חלב",
  "freqValue": 3,
  "freqUnit": "days",
  "lastDone": "2026-03-24T00:00:00.000Z",
  "nextDue": "2026-03-27T00:00:00.000Z"
}
```

**Core Logic:**
1. **View Routing:** Class-toggling mechanism between Agenda and Track views.
2. **Date Comparison:** UTC-based handling, normalized to midnight for accurate daily comparisons.
3. **Statuses:** 
    - Red: Overdue.
    - Yellow: Today.
    - Green: Future.
4. **Management:** Button grid allowing addition/removal of objects from the Tasks array.

## Future Development: Multi-User Support & Cloud Sync
To enable multi-device access and data isolation for different users, the following steps are planned:

### Authentication Layer:
- Integrate a user management system (e.g., Supabase Auth).
- Support for Email or Google account login.

### Cloud Database:
- Transition from `localStorage` to a managed database (PostgreSQL).
- Store allergen settings and report history per user.

### Sync Logic:
- Offline-First model: local storage with background cloud synchronization.
- Data merging upon logging in from a new device.
