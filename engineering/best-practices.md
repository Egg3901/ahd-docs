# Best Practices

Recurring patterns, anti-patterns, and guidance distilled from auditing the A House Divided codebase. Every recommendation is grounded in actual code — not generic dogma.

---

## 1. API Route Hygiene

### Always use `require*` helpers — never `getAuthUser()` in route handlers

**Why:** `getAuthUser()` returns `null` on failure; a manual `if (!user)` check silently skips the structured error response that `requireAuth()` provides. More importantly, `requireAdmin()` does a DB-authoritative admin check while `getAuthUser().isAdmin` trusts a potentially stale JWT claim.

**Pattern:**

```ts
// ✅ Correct
const auth = await requireAuth();
if (!auth.ok) return auth.response;

// ❌ Wrong — bypasses structured error handling
const user = await getAuthUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**Reference:** `src/lib/api/requireAuth.ts` provides `requireAuth`, `requireBasicAuth`, and `requireAuthWithCharacter`. See `docs/engineering/api-route-checklist.md` §1 for the full table.

### Always validate request bodies with `parseJsonBody(request, zodSchema)`

**Why:** Custom parsers (manual type assertions, ad-hoc `.parse()` objects) produce inconsistent error messages and miss edge cases. `parseJsonBody` handles malformed JSON, Zod validation failures, and returns structured `{ error, status }`.

**Anti-pattern found:** `src/app/api/whitehouse/bills/[id]/action/route.ts` had a hand-rolled `actionSchema.parse()` with `request.json().catch(() => ({}))` — silently converting malformed JSON into an empty object instead of returning 400.

### Wrap the entire handler in `try/catch` with `handleRouteError`

**Why:** If `requireAdmin()` or `getDb()` throws _before_ the inner try-catch, the route returns an unformatted 500 with no Sentry capture.

**Anti-pattern found:** `src/app/api/admin/cabinet-nominations/route.ts` GET handler had `requireAdmin()` outside the try-catch block.

---

## 2. Type Safety

### Avoid `Record<string, unknown>` for known shapes

**Why:** `unknown` erases the type of values, defeating the point of TypeScript. When the value type is known (numbers for population shifts, ObjectIds for references), use it.

**Pattern:**

```ts
// ✅ Values are population numbers
const updates: Record<string, number> = {};

// ❌ Loses type information
const updates: Record<string, unknown> = {};
```

**Reference:** `src/lib/demographicEffects.ts` bulk operation types.

### Prefer reassignment over `Object.assign` for re-fetched documents

**Why:** `Object.assign(bill, fresh)` mutates the loop variable in place. TypeScript does not narrow the type after `Object.assign`, so the compiler cannot verify that the fresh fields are used. Reassignment (`bill = fresh`) is explicit and type-safe.

**Pattern:**

```ts
// ✅ Clear reassignment — TypeScript tracks the type
for (let bill of expiredBills) {
  const fresh = await db.collection<Bill>("bills").findOne({ _id: bill._id });
  if (fresh) bill = fresh;
  // ...
}

// ❌ Mutation with no type narrowing
for (const bill of expiredBills) {
  const fresh = await db.collection<Bill>("bills").findOne({ _id: bill._id });
  if (fresh) Object.assign(bill, fresh);
  // ...
}
```

**Reference:** `src/lib/billLifecycle.ts` — three instances in origin-chamber, other-chamber, and veto-override loops.

---

## 3. Database Access

### Bulk-fetch upfront; avoid N+1 queries in loops

The codebase generally does this well. Good examples:

- `src/lib/turn/campaignTurn.ts` — parallel `Promise.all` for characters and NPPs
- `src/lib/turn/corporationTurn.ts` — seven collections fetched in parallel
- `src/lib/demographicEffects.ts` — pre-builds maps, single `bulkWrite` at end

**Watch for:** `getActivePoliciesForState()` called per-state inside a loop (`src/lib/turn/policyEffects.ts`). If the caller iterates states, this becomes N+1. Prefer fetching all policies once and filtering in-memory.

### Guard division-by-zero in threshold calculations

**Why:** Quorum and supermajority calculations like `Math.ceil((2/3) * memberCount)` return `0` when `memberCount` is `0`, making any vote count pass. Always guard:

```ts
if (memberCount === 0) {
  // No members — vote cannot pass
  continue;
}
const threshold = Math.ceil((2 / 3) * memberCount);
```

**Reference:** `src/lib/billLifecycle.ts` veto-override logic (lines ~419–420).

---

## 4. Turn Processing

### Phase isolation is load-bearing — do not bypass `runPhase()`

Every turn phase is wrapped in `runPhase()` which catches errors, logs to Sentry, and appends to `warnings` without halting subsequent phases. Adding a phase outside this wrapper risks crashing the entire turn on a single failure.

**Reference:** `src/lib/turnSystem.ts` `runPhase()` function.

### Group 7 ordering is strictly sequential

Primary resolution → vote accumulation → timer advancement → snapshots → general resolution → leadership vacate. Reordering or parallelizing within Group 7 produces incorrect election results.

---

## 5. Error Handling

### Log meaningful context for silent skips in bulk loops

**Why:** Bulk processing loops (`for (const state of states)`) that `continue` on missing data make debugging production issues difficult. Add a counter or warning when significant data is missing.

**Pattern:**

```ts
let skipped = 0;
for (const state of states) {
  const demographics = demographicsMap.get(state._id);
  if (!demographics) {
    skipped++;
    continue;
  }
  // ...
}
if (skipped > 0) {
  console.warn(`[DemographicEffects] Skipped ${skipped} states with missing demographics`);
}
```

### Use structured error helpers, not inline `NextResponse.json({ error: ... })`

The `@/lib/api/errors` module provides `badRequest()`, `notFound()`, `forbidden()`, `unauthorized()`, and `internalError()`. These return `ApiError` objects that `handleRouteError` knows how to format consistently. Prefer throwing them over constructing `NextResponse.json` manually for error paths.

---

## 6. UI Patterns

### Use `useAsyncData` for client-side data fetching

The `src/hooks/useAsyncData.ts` hook handles AbortController cleanup, error state, and refetch. Pages that reinvent the fetch-loading-error pattern inline should migrate to it.

### Centralize auto-refresh intervals

Multiple pages hardcode `60_000` ms intervals for polling. Consider defining these as constants in `src/lib/constants/` so refresh rates can be tuned in one place.

---

## Audit History

| Date       | Scope           | Key findings                                                                                                                                                                                                                                                                          |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-23 | Full repo audit | Whitehouse bills routes using `getAuthUser()` instead of `requireAuth()`; custom validation instead of Zod; `Object.assign(bill, fresh)` in billLifecycle; `Record<string, unknown>` in demographicEffects; cabinet-nominations GET missing try-catch around requireAdmin. All fixed. |
