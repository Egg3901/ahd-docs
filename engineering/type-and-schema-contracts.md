# Type and schema contracts

This document describes how **compile-time types** and **runtime validation** work together in A House Divided, and where each is required.

## Philosophy

1. **Static types** document invariants inside the codebase and catch refactors at build time. They do not prove anything about data that crosses a trust boundary (HTTP, MongoDB, JWT claims, cron payloads, third-party hooks).

2. **Runtime validation** (primarily **Zod**) is required at every boundary where data is produced by an untrusted or external source. Parsing fails closed: invalid input becomes a 4xx response or a rejected/null token, not a partially trusted object.

3. **Avoid decorative type complexity** — extra generics, branded types, or deep conditional types are only justified when they remove real bugs or encode a stable domain rule. Prefer a small Zod schema and a shared `z.infer` type over duplicating shapes by hand.

4. **MongoDB documents** are trusted only after the code that reads them has enforced expected shapes (queries, projections, application-level checks). TypeScript generics on `collection<T>()` describe intent; they do not validate at runtime. Treat documents that can be corrupted by legacy seeds or partial writes as `unknown` and parse when the risk matters.

## Trust boundaries (what to validate)

| Boundary             | Typical mechanism                                              | Notes                                                                                           |
| -------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| HTTP request bodies  | `parseJsonBody(request, zodSchema)` in `@/lib/api/validate`    | Always validate JSON before use.                                                                |
| URL / search params  | `parseBoundedIntParam`, `schemas.objectId`, route-specific Zod | ObjectIds must match hex length/pattern before `new ObjectId`.                                  |
| Environment          | `envSchema` in `@/lib/env`                                     | Eager validation on startup (skipped in `NODE_ENV===test`).                                     |
| JWT cookie payload   | `userPayloadSchema` in `@/lib/auth`                            | Cryptographic verification is not enough; claims must match expected shape.                     |
| Public API responses | Strip server secrets before JSON (e.g. `toPublicGameConfig`)   | Never return Discord webhook URLs or other automation secrets to browsers.                      |
| Database reads       | Typed collections + domain logic                               | Use precise TS types for maintainability; add parsing when accepting arbitrary/aggregated data. |

## When TypeScript alone is enough

- **Internal function calls** where all arguments are already validated or constructed in the same module.
- **Constants and config** authored in TypeScript (`src/lib/constants/`, country configs) — single source of truth, no untrusted input.
- **Narrowed branches** after an explicit runtime check (e.g. `if (x === "a")` then handling `x` in that block).

## When runtime validation is required

- Any **string from the network** (body, header, query) before it influences auth, DB queries, or game logic.
- **JWT payloads** after `jwtVerify` — the signature proves issuer intent; Zod proves the payload matches our session contract (`userPayloadSchema`).
- **Admin-only or script routes** — same rules as player routes; `requireAdmin` does not validate body shape.
- **Responses leaving the server to untrusted clients** when the underlying document includes **secrets** — map to a public DTO (`PublicGameConfig`).

## Project conventions

- **Bundling:** The `mongodb` package is Node-only. Do not import `src/lib/utils/objectId.ts` (uses `ObjectId`) from Client Components or from modules imported by them. Use `src/lib/utils/objectIdHex.ts` for `HEX_OBJECT_ID_REGEX` and `isHexObjectIdString` in shared code; see `docs/engineering/shared-utility-guidelines.md`.
- Shared Zod pieces live under `src/lib/api/schemas/`; shared primitives (e.g. `schemas.objectId`) live in `src/lib/api/validate.ts`.
- MongoDB document shapes live in `src/lib/db/types/` as TypeScript interfaces; keep them aligned with seeds and migrations when fields change.
- Prefer `z.infer<typeof schema>` for API DTOs to avoid two sources of truth.

## Related files (reference)

| Concern                        | Location                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| JSON body parsing              | `src/lib/api/validate.ts` (`parseJsonBody`)                                                                            |
| Env validation                 | `src/lib/env.ts`                                                                                                       |
| JWT claim shape                | `src/lib/auth.ts` (`userPayloadSchema`, `verifyAuth`)                                                                  |
| Public game config             | `src/lib/db/types/gameConfig.ts` (`PublicGameConfig`), `src/lib/gameConfig/publicGameConfig.ts` (`toPublicGameConfig`) |
| Leadership election DB filters | `src/lib/congress/leadershipElections.ts`, `src/lib/congress/leadershipState.ts`                                       |
| ObjectId hex vs `ObjectId`     | `src/lib/utils/objectIdHex.ts`, `src/lib/utils/objectId.ts`                                                            |

## Deferred / known gaps

- Many routes still rely on TypeScript for response bodies without a Zod encode step; that is acceptable when the payload is built from already-validated inputs and contains no secrets.
- Historical MongoDB documents may not match current interfaces; defensive checks belong next to high-risk reads (turn processing, elections), not necessarily every `findOne`.
