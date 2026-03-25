# Technical Design - Alergenics (English Documentation)

**Tools:**
* HTML5 for page structure (RTL for UI).
* CSS3 for card-based interface, button grids, and color-coded statuses.
* JavaScript (ES6+) for state management, date arithmetic, and DOM manipulation.

**Data Storage:**
* Firebase Firestore: Cloud-based NoSQL database for real-time synchronization.
* Collection Structure: `users/{uid}/allergens/{allergen_id}`.
* Firebase Authentication: Google/Email login for personalized states.

## 1. Architectural Overview
The app uses a triple-view architecture (Login, Agenda, and Settings). Navigation is managed via a single "Settings" button in the main view, a logout button, and an "Accept" button in the Settings view. Native back-button support is implemented via the History API.

### Views:
0.  **כניסה (Login):** Required view for unauthenticated users.
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

## 5. Cloud Backend & Security
Firebase provides the primary backend infrastructure, secured via multiple layers of protection:

### Firestore Security Rules:
The database is protected by granular rules ensuring that users can only read or write their own documents.
```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /allergens/{allergenId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

### Authentication & Domain Whitelisting:
- **Firebase Auth:** Manages user identity.
- **Authorized Domains:** Only specific production and development domains (e.g., `alergenics-he.web.app`, `localhost`) are whitelisted in the Firebase Console to prevent unauthorized origin calls.

### App Check (App Attestation):
- **Mechanism:** Integrates with reCAPTCHA Enterprise (web) or native attestation (App Store/Play Store) to ensure traffic originates only from the official Alergenics application.
- **Enforcement:** Firestore and Authentication requests are rejected if a valid App Check token is missing. This prevents scraping, bot traffic, and unauthorized API usage.
- **Provider Configuration:** The web app uses reCAPTCHA v3 or Enterprise as the attestation provider, configured via the Firebase Console and initialized in the client-side code.

### CORS & Network Security:
- Firebase Hosting automatically handles CORS for its own services.
- A strict `Content-Security-Policy` (CSP) and CORS headers will be configured in the `firebase.json` headers section to restrict script execution and cross-site requests.
