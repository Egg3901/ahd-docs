# AHD Desktop Client Integration Guide

This document covers everything a desktop client (Electron/Tauri) needs to integrate with the A House Divided web API.

Deployment is on **Railway** (development → staging → main), not Vercel.

---

## Authentication

AHD uses **HTTP-only JWT cookies** for authentication. The cookie is named `token` and is set on login.

**For the desktop client:**

- Use a persistent cookie jar (e.g., Electron's `session.cookies` or a custom `tough-cookie` jar with `axios`)
- Log in via `POST /api/auth/login`, the cookie is set automatically in the response
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

`GET /api/client-nav`, no auth required (returns guest manifest if unauthenticated)

This is the primary polling endpoint for the client. Poll it every 30-60 seconds to keep the UI in sync.

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
    label: string; // e.g. "U.S. Senate, CA"
  } | null;
  activePresidentElectionId: string | null;
  activePresidentElectionSeatId: string | null;
  missingDemographics: boolean;
}
```

`client-nav` does **not** carry funds, actions, cash-on-hand, or projected income, those are served by `GET /api/client-status`, the status-bar endpoint.

### `projectedIncome` (on `GET /api/client-status`)

```
projectedIncome = (50000 + donorBaseLevel * 2000) * (1 + politicalInfluence / 100)
```

`calculateFundraisingAmount()` in `src/lib/actions.ts`: a $50,000 floor plus $2,000 per donor base level, scaled by a state-influence multiplier (1.0x at 0% influence to 2.0x at 100%). This is the per-use Fundraise action yield.

---

## Theme Settings

`PATCH /api/settings/theme`, requires auth cookie

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

### Internal event emit (not client-facing)

After a successful PATCH, the server calls `emit({ type: "theme_changed", ... })` on an in-process event bus (`src/lib/events.ts`). **This emitter has no HTTP consumer**, there is no route that streams it to a client. It exists as internal plumbing only.

**Do not build an SSE/EventSource integration for theme sync.** Poll instead: re-fetch `/api/client-nav` after any theme change action, or on a short interval.

---

## No SSE Event Stream

**`GET /api/events` is not an SSE endpoint.** It is a REST resource for the in-game "events" (crisis/random-event) system, `GET /api/events/active`, `GET /api/events/[id]`, unrelated to real-time client sync. There is no `text/event-stream` endpoint anywhere in the public API surface, and no `EventSource`-based integration is possible today.

For turn updates, election results, and any other near-real-time state, **poll the relevant REST endpoint** (see Polling Recommendations below) rather than expecting a push channel.

---

## Error Codes

`GET /api/error-codes`, no auth required

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
| ---------------------------- | ---------------------- |
| `PATCH /api/settings/theme` | 30 req / 60s per user |
| Most player action routes   | 20-30 req / 60s       |
| Auth routes                 | 10 req / 60s          |

Rate-limited responses return `429` with a `Retry-After` header (seconds).

---

## Polling Recommendations

There is no push channel for the desktop client, poll for all near-real-time state:

| Data                               | Recommended approach              |
| ------------------------------------ | ------------------------------------ |
| Nav state (unread, party, election) | Poll `/api/client-nav` every 60s     |
| Funds, actions, projected income   | Poll `/api/client-status` every 60s |
| Theme sync                         | Re-fetch `/api/client-nav` after PATCH |
| Turn updates / election results    | Poll the relevant status endpoint on a short interval |
