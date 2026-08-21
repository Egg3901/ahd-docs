# API Route Checklist

Use this checklist when creating or reviewing any `route.ts` file under `src/app/api/`.

## Canonical Route Structure

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/api/requireAuth"; // or requireAdmin / requireCron
import { parseJsonBody } from "@/lib/api/validate";
import { handleRouteError } from "@/lib/api/errors";
import { z } from "zod";

const schema = z.object({/* ... */});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const parsed = await parseJsonBody(request, schema);
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error },
        { status: parsed.status },
      );

    const db = await getDb();
    // ... business logic ...
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
```

---

## Checklist

### 1. Auth Guard

- [ ] Every handler has an auth check as the **first thing inside the `try` block**, before any DB access.
- [ ] Use `requireAdmin()` for `/api/admin/*` routes — never `getAuthUser()` with a manual `if (user?.isAdmin)` check.
- [ ] Use `requireCron(request)` for cron-triggered routes, and return 401 immediately if it fails.
- [ ] Use the narrowest suitable `require*` guard for required-auth routes. Human-only mutations should use `requireHumanSession()` or `requireHumanSessionWithCharacter()` so bot tokens are rejected.
- [ ] Optional-auth public reads may use `getAuthUser()` and treat `null` as a guest. Required-auth and mutating routes should use a `require*` wrapper.

| Route type         | Correct guard                       | Wrong pattern                            |
| ------------------ | ----------------------------------- | ---------------------------------------- |
| Admin route        | `requireAdmin()`                    | `getAuthUser()` + `if (!user?.isAdmin)`  |
| Player (basic)     | `requireBasicAuth()`                | Manual required-auth branching           |
| Player (character) | `requireAuthWithCharacter()`        | `requireAuth()` + manual character check |
| Human session      | `requireHumanSession*()`            | Token-capable guard on human-only write  |
| Moderator          | `requireModerator()`                | Manual role check                        |
| Bot token          | `requireBotToken()`                 | Ad hoc header parsing                    |
| Cron route         | `requireCron(request)` → return 401 | No check / JWT check                     |

### 2. Error Handling

- [ ] Every exported route function is wrapped in `try { ... } catch (error) { return handleRouteError(error); }`.
- [ ] Do **not** silently swallow errors — `handleRouteError` logs to Sentry and formats the response.
- [ ] Throw `badRequest()`, `notFound()`, `forbidden()`, `unauthorized()`, or `internalError()` from `@/lib/api/errors` for known error conditions; let `handleRouteError` catch them.
- [ ] Do **not** re-implement error formatting manually (e.g., `NextResponse.json({ error: "..." }, { status: 500 })` for unhandled errors).

### 3. Body Validation

- [ ] All request bodies pass through `parseJsonBody(request, zodSchema)` — **no** `request.json()` with manual type assertions.
- [ ] Check `if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: parsed.status })`.
- [ ] Schema is inlined in the route file unless it is shared across multiple routes (then add to `src/lib/api/schemas/`).
- [ ] Use `schemas.objectId` from `@/lib/api/validate` for 24-hex ID fields.
- [ ] Numeric inputs use `.min()` / `.max()`; strings use `.min()` / `.max()` for length bounds where relevant.

### 4. Dynamic Route Params (Next.js 16)

- [ ] Always `await params` before reading — params is a `Promise` in Next.js 16.
  ```ts
  export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id } = await params;
  ```
- [ ] Validate string param IDs before converting: use `schemas.objectId` in a Zod schema, or `ObjectId.isValid(id)` as a guard before `new ObjectId(id)`.

### 5. Response Shape

- [ ] Success responses use `NextResponse.json({ ... })` with 200 (default).
- [ ] Mutating routes return `{ success: true }` or a descriptive `{ message: "..." }`.
- [ ] Error responses follow `{ error: string }` — optionally with `code` and `details` fields as provided by `ApiError.toJson()`.
- [ ] Do **not** return the full MongoDB document — explicitly project/whitelist fields to avoid leaking `password`, `isAdmin`, IP, fingerprint, or other sensitive fields.
- [ ] Do not return `_id` as an ObjectId — call `.toString()` on ObjectId fields before returning.

### 6. Rate Limiting

- [ ] Auth endpoints (`/api/auth/login`, `/api/auth/register`) use `AUTH_LIMITS` (10 req/min/IP).
- [ ] Feedback endpoints use `FEEDBACK_LIMITS` (5 req/min/IP).
- [ ] Congress/election write actions use `CONGRESS_LIMITS` / `ELECTION_LIMITS` where appropriate.
- [ ] New write endpoints that are user-facing and abuse-prone should use `checkRateLimit(identifier, max, windowMs)` from `@/lib/api/rateLimit`.

### 7. Authorization (Resource Ownership)

- [ ] Character mutations verify `character.userId.equals(new ObjectId(auth.user.userId))`.
- [ ] Party actions verify the user's character is a member of that party.
- [ ] Election actions verify the candidate belongs to the authenticated user.
- [ ] Admin-only operations use `requireAdmin()` — **not** `requireAuth()` + a manual `isAdmin` flag check.

### 8. Data Safety

- [ ] Response never includes `passwordHash`, `password`, or any field beginning with those names.
- [ ] Response never includes auth secrets, cron secrets, or environment variable values.
- [ ] Admin-only fields (IP address, fingerprint, ban reason, `isAdmin`) are excluded from player-facing responses.
- [ ] `handleRouteError` captures unhandled failures with Sentry and `alertOps`. Development responses may include `error.message`; stack traces remain server-side.

---

## Common Mistakes

| Mistake                                                   | Risk                                                                | Fix                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `getAuthUser()` + `if (!user?.isAdmin)` on an admin route | Stale JWT `isAdmin` claim bypasses DB-authoritative check           | Use `requireAdmin()`                                                         |
| Missing `try/catch` wrapper                               | DB errors crash with unformatted 500, no Sentry capture             | Wrap full handler in `try { ... } catch { return handleRouteError(error); }` |
| `request.json()` without Zod validation                   | Type coercion, missing fields, object injection                     | Use `parseJsonBody(request, schema)`                                         |
| `params.id` without await                                 | Next.js 16 params is a Promise; accessing `.id` returns `undefined` | `const { id } = await params`                                                |
| Returning full DB document                                | Exposes password hash, IP, admin flags                              | Explicitly project/whitelist fields                                          |
| `new ObjectId(untrustedString)` without validation        | Throws on invalid input, may return unhandled 500                   | Validate with `schemas.objectId` or `ObjectId.isValid()` first               |

---

## Auth Helper Quick Reference

| Helper                                          | Import                           | Returns                                  | When to use                   |
| ----------------------------------------------- | -------------------------------- | ---------------------------------------- | ----------------------------- |
| `requireAuth()`                                 | `@/lib/api/requireAuth`          | `{ ok, user }` with optional character   | Most player routes            |
| `requireBasicAuth()`                            | `@/lib/api/requireAuth`          | `{ ok, user }` without character lookup  | Fast auth-only checks         |
| `requireAuthWithCharacter()`                    | `@/lib/api/requireAuth`          | `{ ok, user }` with guaranteed character | Routes needing character data |
| `requireHumanSession()`                         | `@/lib/api/requireAuth`          | Authenticated human session              | Human-only mutations          |
| `requireHumanSessionWithCharacter()`            | `@/lib/api/requireAuth`          | Human session with character             | Human-only character writes   |
| `requireAdmin()`                                | `@/lib/api/requireAdmin`         | `{ ok, admin }`                          | All `/api/admin/*` routes     |
| `requireModerator()`                            | `@/lib/api/requireModerator`     | Moderator authorization                  | Moderator routes              |
| `requireBotToken()` / `requirePublicBotToken()` | `@/lib/api/requireBotToken`      | Bot authorization                        | Bot-facing routes             |
| `requireAdminOrApiKey(request)`                 | `@/lib/api/requireAdminOrApiKey` | `{ ok, via }`                            | Script/automation routes      |
| `requireCron(request)`                          | `@/lib/api/requireCron`          | `boolean`                                | Cron-triggered routes         |

All `require*` helpers return `{ ok: false; response }` on failure. Pattern:

```ts
const auth = await requireAdmin();
if (!auth.ok) return auth.response;
```

---

## Audit History

These dated route counts and findings are snapshots, not a current assertion
that every route remains covered. The repository has grown substantially since
the 2026 audits.

| Date       | Auditor                  | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-23 | Claude (automated audit) | `admin/bills` GET/POST missing try/catch; `admin/politician-pages/backfill` and `admin/campaigns/[id]/assign-manager` using `getAuthUser()+isAdmin` instead of `requireAdmin()`; `assign-manager` POST using `request.json()` without Zod validation. All three fixed.                                                                                                                                                                  |
| 2026-04-15 | Claude (automated audit) | 615 routes scanned. No raw `request.json()` usage found. No admin routes using `getAuthUser()` instead of `requireAdmin()`. 4 cabinet position routes missing `COUNTRY_CONFIGS` validation on `as CountryId` cast (allocation, briefing, order, setting). All auth guards accounted for (routes use `requireAuth`, `requireAdmin`, `requireModerator`, `requireBotToken`, `requireCron`, or are documented public). See findings below. |
