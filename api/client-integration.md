# AHD Desktop Client Integration Guide

This document covers everything a desktop client (Electron/Tauri) needs to integrate with the A House Divided web API.

---

## Authentication

AHD uses **HTTP-only JWT cookies** for authentication. The cookie is named `token` and is set on login.

**For the desktop client:**

- Use a persistent cookie jar (e.g., Electron's `session.cookies` or a custom `tough-cookie` jar with `axios`)
- Log in via `POST /api/auth/login` — the cookie is set automatically in the response
- All authenticated requests must include the cookie; there is no Bearer token alternative for player routes
- Admin/automation routes accept `X-Api-Key: <key>` as an alternative (internal use only)

**Login request:**

```http
POST /api/auth/login
Content-Type: application/json

{ "username": "...", "password": "..." }
```

**Response:**

```json
{ "success": true }
```

The `Set-Cookie: token=...` header in the response sets the auth cookie.

---

## Core Navigation Endpoint

`GET /api/client-nav` — no auth required (returns guest manifest if unauthenticated)

This is the primary polling endpoint for the client. Poll it every 30–60 seconds to keep the UI in sync.

### Response Shape

```ts
interface ClientNavResponse {
  user: { username: string; isAdmin: boolean } | null;
  hasCharacter: boolean;
  characterCountryId: string | null; // "US" | "UK" | "CA" | "DE"
  unreadCount: number; // unread notifications
  unreadMailCount: number; // unread player mail
  homeState: { id: string; name: string } | null;
  currentParty: { id: string; name: string } | null;
  activeElection: {
    id: string;
    seatId?: string;
    label: string; // e.g. "U.S. Senate — CA"
  } | null;
  activePresidentElectionId: string | null;
  activePresidentElectionSeatId: string | null;
  missingDemographics: boolean;
  // Character financial fields (null when no character or unauthenticated)
  funds: number | null; // campaign funds
  actions: number | null; // action points remaining this turn
  cashOnHand: number | null; // personal cash (separate from campaign funds)
  projectedIncome: number | null; // projected fundraising income next turn
}
```

### `projectedIncome` formula

```
projectedIncome = 50000 + donorBaseLevel * 10000
```

Base of $50,000 per turn, +$10,000 per donor base level (0–5). This is the fundraising action yield.

---

## Theme Settings

`PATCH /api/settings/theme` — requires auth cookie

### Request

```http
PATCH /api/settings/theme
Content-Type: application/json

{ "theme": "dark" }
```

### Response

```json
{ "success": true }
```

### SSE Event: `theme_changed`

After a successful PATCH, the server emits a `theme_changed` event over SSE:

```ts
{
  type: "theme_changed",
  payload: { theme: string; userId: string },
  timestamp: string,  // ISO 8601
  userId: string,
}
```

**Critical limitation:** SSE in AHD is in-process only (single Vercel serverless instance). The client's SSE connection and the PATCH request may land on different server instances, causing the event to be silently dropped. **Do not rely on SSE alone for theme sync.** Implement a polling fallback: re-fetch `/api/client-nav` after any theme change action, or poll on a short interval.

---

## SSE Events

`GET /api/events` — no auth required

AHD uses a lightweight in-process pub/sub. All events share this shape:

```ts
interface GameEvent {
  type: "turn_complete" | "election_resolved" | "bill_enacted" | "theme_changed";
  payload: Record<string, unknown>;
  timestamp: string; // ISO 8601
  userId?: string;
}
```

### Validating events

Use this guard when parsing SSE messages:

```ts
function validateSSEEvent(event: unknown): event is GameEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "type" in event &&
    typeof (event as any).type === "string" &&
    "payload" in event &&
    "timestamp" in event
  );
}
```

### Event reference

| Type                | Payload                                     | Notes                                           |
| ------------------- | ------------------------------------------- | ----------------------------------------------- |
| `turn_complete`     | `{ turn: number, year: number }`            | Fired each hourly turn                          |
| `election_resolved` | `{ electionId: string, winnerId?: string }` | Fired when an election concludes                |
| `bill_enacted`      | `{ billId: string, billTitle: string }`     | Fired when a bill passes                        |
| `theme_changed`     | `{ theme: string, userId: string }`         | Fired on theme PATCH; unreliable cross-instance |

### Connection example

```ts
const es = new EventSource("/api/events");

es.addEventListener("turn_complete", (e) => {
  const event = JSON.parse(e.data);
  // handle turn
});

es.addEventListener("theme_changed", (e) => {
  const event = JSON.parse(e.data);
  // apply theme: event.payload.theme
});

es.onerror = () => {
  // EventSource reconnects automatically; re-fetch /api/client-nav on reconnect
};
```

Events are sent as **named SSE events** (`event: <type>`). Use `addEventListener` with the event type name, not `onmessage`.

### Reconnection

`EventSource` reconnects automatically. On reconnect, re-fetch `/api/client-nav` to catch any state missed while disconnected.

---

## Error Codes

`GET /api/error-codes` — no auth required

Returns a static versioned catalog. Cache it at startup; re-fetch if `version` changes.

### Response

```json
{
  "version": "1",
  "errors": [
    {
      "code": "BAD_REQUEST",
      "httpStatus": 400,
      "category": "validation",
      "message": "Invalid request data"
    },
    {
      "code": "UNAUTHORIZED",
      "httpStatus": 401,
      "category": "auth",
      "message": "Authentication required"
    },
    { "code": "FORBIDDEN", "httpStatus": 403, "category": "auth", "message": "Forbidden" },
    {
      "code": "NOT_FOUND",
      "httpStatus": 404,
      "category": "not_found",
      "message": "Resource not found"
    },
    {
      "code": "INTERNAL_ERROR",
      "httpStatus": 500,
      "category": "system",
      "message": "Internal server error"
    }
  ]
}
```

### Error response shape (all error responses)

```json
{ "error": "Human-readable message", "code": "MACHINE_CODE" }
```

Always check `code` for programmatic handling; `error` is for display.

---

## Rate Limits

| Endpoint                    | Limit                 |
| --------------------------- | --------------------- |
| `PATCH /api/settings/theme` | 30 req / 60s per user |
| Most player action routes   | 20–30 req / 60s       |
| Auth routes                 | 10 req / 60s          |

Rate-limited responses return `429` with a `Retry-After` header (seconds).

---

## Polling Recommendations

Since SSE is unreliable across Vercel instances, prefer polling for critical state:

| Data                               | Recommended approach                            |
| ---------------------------------- | ----------------------------------------------- |
| Nav state (funds, actions, unread) | Poll `/api/client-nav` every 60s                |
| Theme sync                         | Re-fetch after PATCH + SSE fallback             |
| Turn updates                       | SSE `turn_complete` + re-fetch on reconnect     |
| Election results                   | SSE `election_resolved` + re-fetch on reconnect |
