# Shared utilities and helpers

This document explains where shared code belongs in A House Divided, when to add a helper versus keeping logic inline, and which existing abstractions to prefer. It complements [`architecture-boundaries.md`](./architecture-boundaries.md) and [`repo-operating-map.md`](./repo-operating-map.md).

## Layers at a glance

| Area                                       | Primary location                                                    | Notes                                                        |
| ------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| HTTP / JSON / query parsing                | `src/lib/api/` (`validate.ts`, route helpers)                       | Use with API routes and shared Zod schemas.                  |
| MongoDB ObjectId strings                   | `src/lib/utils/objectIdHex.ts` (client-safe), `objectId.ts` (parse) | Hex regex / branching vs `ObjectId` construction; see below. |
| Display formatting (currency, dates, time) | `src/lib/utils/formatters.ts`                                       | UI and API responses that need consistent copy.              |
| User input in Mongo `$regex`               | `src/lib/utils/escapeRegex.ts`                                      | Always escape before interpolating into regex.               |
| Simulation / game rules                    | `src/lib/` domain modules (`turn/`, `electionEngine/`, etc.)        | Prefer named domain functions over generic “math helpers.”   |
| DB types and collection accessors          | `src/lib/db/types/`, `src/lib/db/collections/`                      | Not “utilities”—keep typed data access explicit.             |

## When to add a shared helper

Add a helper when **all** of the following are true:

1. **The same behavior appears in multiple places** (not “might appear later”).
2. **The behavior is stable**—bug fixes should apply everywhere at once.
3. **A single name** makes call sites clearer than repeating the implementation.

Examples already in the codebase: `parseJsonBody`, `escapeRegex`, `formatCurrency`, `parseObjectId`, `parseBoundedIntParam` for repeated query-limit patterns, `isHexObjectIdString` for distinguishing ObjectId strings from other route segments.

## When to keep logic inline

Prefer inline code when:

- **The logic is only used once**, or differs slightly per call site (different clamps, labels, or side effects).
- **The abstraction would be overly generic**—e.g. a `clamp()` used once with specific domain meaning; a short `Math.min`/`Math.max` for a progress bar is fine.
- **Naming the helper would hide domain meaning**—e.g. “`processData`” or “`normalize`” without a game-specific name.

Duplicating a five-line block once is cheaper than maintaining the wrong abstraction.

## ObjectId and validation

- **`parseObjectId`** (`src/lib/utils/objectId.ts`): use when you need an `ObjectId` instance from a route param; returns `null` if invalid. Imports `mongodb` — **do not** import this file from Client Components.
- **`HEX_OBJECT_ID_REGEX` / `isHexObjectIdString`** (`src/lib/utils/objectIdHex.ts`): no `mongodb` dependency; safe from **Client Components** and shared URL helpers (e.g. `profileUrls.ts`).
- **`schemas.objectId` / `schemas.nppObjectId`** (`src/lib/api/validate.ts`): use in Zod for request bodies; messages differ where UX calls for it (`Invalid ID format` vs `Invalid NPP ID format`). Both use **`HEX_OBJECT_ID_REGEX`** from `objectIdHex.ts` so the pattern stays single-sourced.
- **`isHexObjectIdString`**: use for **branching** (e.g. election route: ObjectId vs seat slug) without constructing an `ObjectId`.

Avoid sprinkling raw `/^[a-f0-9]{24}$/i` across the codebase; extend `objectIdHex.ts` / `validate.ts` if the rule evolves.

## API routes

Follow `AGENTS.md` and [API Route Checklist](./api-route-checklist.md): use the
appropriate `require*` guard, `parseJsonBody`, `handleRouteError`, and shared
schemas under `src/lib/api/schemas/`.

For **numeric query params** with defaults and min/max caps, use **`parseBoundedIntParam`** so missing keys, `NaN`, and out-of-range values behave consistently.

## Formatting and UI

Use **`formatters.ts`** for money, population, and dates shown to players unless a design explicitly requires a different locale or precision variant (`formatCurrencyPrecise`, `formatCurrencyFull`).

Do not introduce a generic “string format” layer for one-off labels.

## Tests

New shared helpers should have co-located Vitest coverage (`*.test.ts` next to the module or under `src/lib/api/` for `validate.ts`).

## Related audit notes (this pass)

- Consolidated hex ObjectId detection and Zod regex onto `HEX_OBJECT_ID_REGEX` / `isHexObjectIdString`.
- Centralized bounded `limit` parsing for admin list routes via `parseBoundedIntParam`.
- Reused `schemas.nppObjectId` in the party influence schema instead of a duplicate regex.

Deferred: unifying every API route’s `limit`/`page` parsing (different defaults and caps per route); deduplicating local `isSeatId` implementations beyond the shared hex check—the remaining seat-slug rules stay in each route until a single well-named election-route helper is justified by more call sites.
