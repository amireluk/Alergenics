# Shared Boards -- Requirements Document

## Overview

Alergenics is a vanilla HTML/JS/CSS application for tracking allergen exposure. It currently uses Firebase (Firestore + Auth) directly from the client. The "Shared Boards" feature allows one user to create a board, receive a unique board ID, share that ID with another person, and have both users view and update the same allergen tracker.

---

## Functional Requirements

### Board Creation

- Any user can create a new board. No login, no account, no authentication of any kind is required.
- Board creation returns a unique, unguessable board ID.
- The board ID is a 6-character alphanumeric string (a-z, A-Z, 0-9), yielding approximately 56.8 billion possible combinations (62^6).
- The board is immediately usable after creation.

### Board Sharing

- The user shares the board ID with another person out of band (text message, verbal, email, etc.).
- The application does not provide any in-app sharing mechanism beyond displaying the board ID.
- There is no directory, listing, or search of boards. You must know the exact ID.

### Board Access

- A second user enters the board ID to join the board.
- Both users see the same data once they load the board.
- No limit on the number of users who can share a single board ID.

### Shared Data

Both users see and can modify the same board state, which includes:

- **Allergen list** -- the set of allergens being tracked on the board.
- **Cadence** -- the tracking interval (in days) for each allergen.
- **Done/undone states** -- whether each allergen has been marked as done for the current period.

### Supported Updates

The following operations are shared across all users of a board:

- Adding or removing allergens from the list.
- Changing the cadence (number of days) for any allergen.
- Marking an allergen as done or undone.

### Synchronization Model

- Real-time sync is not required.
- The page loads the current board state when opened.
- Periodic refresh is acceptable (e.g., every 30 seconds).
- If two users write at the exact same moment, last write wins. This is an accepted trade-off for the simplicity of the system.

### Authentication Model

- No user accounts.
- No login.
- No passwords.
- The board ID is the sole access token. Possession of the board ID grants full read/write access to that board.

---

## Non-Functional Requirements

### Security

The data tracked in Alergenics is not considered sensitive. The security model protects against abuse (spam, flooding, vandalism), not privacy.

#### Board ID Unguessability

- Board IDs must be generated server-side using a cryptographically suitable random generator.
- 6-character alphanumeric IDs provide approximately 56.8 billion combinations, making brute-force enumeration impractical at any reasonable request rate.

#### No Enumeration

- There must be no API endpoint that lists or enumerates boards.
- A user must know the exact board ID to access a board.
- No search, no discovery, no "recent boards" endpoint.

#### Rate Limiting

- **Board creation:** Maximum 5 new boards per IP address per hour. This prevents database flooding by a single actor.
- **Reads and writes:** Maximum 30 requests per IP address per minute. This prevents abuse of existing boards.

#### Payload Validation

- The server must validate all incoming board data before writing it to storage.
- Only valid board-shaped JSON is accepted. The expected structure is an allergens array where each entry contains:
  - `name` -- a string.
  - `cadence` -- a number between 1 and 30.
  - `lastDone` -- an ISO 8601 date string, or null.
- Any payload that does not match this structure is rejected with an appropriate error.

#### Payload Size Cap

- Maximum payload size: 10KB.
- Requests exceeding this size are rejected before processing.

#### Credential Security

- Database credentials, service account keys, and any secrets must never appear in client-side code.
- The client communicates with the backend via plain HTTP fetch calls. No SDKs, no API keys in the browser.
- **No secrets in git:** All credentials, API keys, service account keys, and environment files (`.env`, `env.js`, `service-account-key.json`) must be listed in `.gitignore`. Only `.example` placeholder files are committed to document the expected format.

---

## API Design

The API surface is intentionally minimal: three endpoints, no authentication headers, no tokens beyond the board ID in the URL.

```
POST   /api/boards           --> Create a new board, return the board ID
GET    /api/boards/:id       --> Return the current board data
PUT    /api/boards/:id       --> Update the board data (full replacement)
```

### POST /api/boards

- **Request body:** None required. The server creates an empty board.
- **Response:** JSON containing the generated board ID.
- **Rate limit:** 5 per IP per hour.

### GET /api/boards/:id

- **Request:** Board ID in the URL path.
- **Response:** JSON containing the full board state (allergens array).
- **Error:** 404 if the board ID does not exist.
- **Rate limit:** 30 per IP per minute (shared with PUT).

### PUT /api/boards/:id

- **Request:** Board ID in the URL path. JSON body containing the full board state.
- **Response:** Success confirmation.
- **Validation:** Payload must pass structure and size validation before being written.
- **Error:** 400 if the payload is invalid. 404 if the board ID does not exist.
- **Rate limit:** 30 per IP per minute (shared with GET).

---

## User Flow

1. User opens the Alergenics app. There is no login screen, no account creation, no authentication prompt.
2. User clicks "Create board." The app sends `POST /api/boards` to the backend.
3. The backend generates a 6-character alphanumeric board ID, creates an empty board in storage, and returns the ID.
4. The app displays the board ID. The user copies it and shares it with another person (via text, verbally, etc.).
5. The second user opens the app and enters the board ID. The app sends `GET /api/boards/:id` and loads the board state.
6. Both users now operate on the same board. Each user's changes are sent via `PUT /api/boards/:id`. Each user sees the latest state on page load or periodic refresh.

---

## Out of Scope

The following are explicitly not part of this feature:

- User accounts or authentication of any kind.
- Real-time collaboration (live cursors, instant sync, conflict resolution).
- Board deletion or expiration (can be added later).
- Permission levels (read-only vs. read-write). All users with the board ID have full access.
- In-app sharing (QR codes, invite links, etc.). Sharing is out of band.
- Offline mode or local caching of board state.
