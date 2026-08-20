# MongoDB access guidelines (A House Divided)

This document complements `AGENTS.md` (in the AHDGame app repo) database conventions. It separates **safe code-level practices** from **database administration** decisions that need human review in production.

## Connection and client

- Use **`getDb()`** from `@/lib/mongodb` in application code. It reuses a pooled `MongoClient` across serverless invocations and selects the database from `MONGODB_DB` / `MONGO_DB_NAME` when present, otherwise from the database embedded in `MONGODB_URI`.
- **Scripts** (outside Next.js) should use `connectDb()` / `closeDb()` from `scripts/utils/db.ts` as documented in `AGENTS.md`.

## Collection access: two supported patterns

1. **Typed collection helpers** in `src/lib/db/collections/`, preferred when a helper already exists or you are touching a hot path that should stay consistent (e.g. `getUsersCollection`, `getCharactersCollection`, `getGameStateCollection`, `getPartyBudgetCollection`).
2. **Direct access**, `db.collection<DocumentType>("collectionName")` is acceptable and common; keep the **generic** correct and the **name** exactly as in existing code (camelCase collection names).

Do **not** introduce a repository framework or generic ORM layer unless there is a strong, explicit need.

### Passing `Db` through call chains

When code already holds `const db = await getDb()` (turn processing, admin batch routes, migrations), pass **`db` into collection helpers** that accept an optional `Db`:

```ts
const users = await getUsersCollection(db);
const characters = await getCharactersCollection(db);
```

That avoids redundant `getDb()` awaits and keeps a single logical scope for one request or one turn.

## Typing and shapes

- Document types live in `src/lib/db/types/`. Use `db.collection<MyType>("myCollection")` (or helpers) so queries and updates stay aligned with the schema.
- Avoid untyped `db.collection("name")` in new code unless the collection is truly schemaless; fixing an existing untyped read is a small, safe improvement when you are already editing the file.

## Queries: hygiene and performance

- **Prefer explicit filters** with fields that match expected indexes (see deferred recommendations below). Avoid relying on unindexed sort or regex prefixes without review.
- **Unbounded `find({}).toArray()`** is appropriate only when the result set is bounded by design (e.g. every character for a turn, small config sets). For player-facing lists, use **`limit`**, **`skip`** (with care), and **`project`** to reduce payload size.
- **`demographicCategories`** and similar reference data are intentionally loaded fully in some simulation paths; treat changes to that pattern as a design decision, not a drive-by optimization.

## Transactions and consistency

- `src/lib/db/runWithOptionalTransaction.ts` wraps `withTransaction` / `ClientSession` and is used in ~10 files where a caller wants transactional semantics. It attempts a real transaction when the Mongo topology supports it (replica set) and falls back to the sequential implementation otherwise. Production Mongo (Railway "Main DB") is currently a **standalone** instance with no replica set, so `withTransaction` always throws there and money-flow writes run **non-atomic** via the fallback path, this is a known, tracked gap, not a design choice.
- **Code-level:** document ordering where it matters; prefer clear phase boundaries (see turn system) over implicit “transaction-like” assumptions in random routes. Use `runWithOptionalTransaction` where partial-write risk is high, but do not assume it is atomic in prod today.
- **DB-level:** true atomicity across collections requires MongoDB multi-document transactions and appropriate write concern on a replica-set-capable deployment, that is an **operational and design** decision, not something to fake in application code.

When adding cross-collection updates, consider: (1) idempotency where possible, (2) admin heal routes for known failure modes, (3) explicit documentation in the relevant design doc under `docs/design/`.

## Indexing and schema changes (human review)

These are **not** substitutes for code review of query patterns:

- Adding or changing **indexes** in production (Atlas or migration scripts).
- **Unique** constraints, **TTL** indexes, or **partial** indexes.
- Large **backfills** or **migrations** that touch many documents.

Track those in release notes, run during maintenance windows when appropriate, and validate on staging with representative data.

### Index concerns implied by common patterns (for DB owners)

The following are **observations** for index planning; verify with `explain` and production metrics:

- **`characters`:** full scans for `processTurn` load all characters, expected for simulation scale; ensure RAM/query budget is acceptable as player counts grow.
- **`elections` / `electionVoteTallies` / `electionCandidates`:** queries often filter by `electionId`, `stateId`, `countryId`, status, and time fields, compound indexes should match real filter combinations.
- **`users`:** `_id` lookups for auth are naturally indexed; avoid adding slow patterns (e.g. unindexed email regex) without an index strategy.

## Testing

- **Unit / integration tests** often mock `@/lib/mongodb` with `createMockDb` (`src/lib/test-utils/mockDb.ts`).
- When changing how routes or auth load data, prefer extending existing tests or adding focused tests that assert **observable behavior** (responses, counts), not MongoDB internals.

## Related docs

- [`repo-operating-map.md`](./repo-operating-map.md), architecture zones and blast radius.
- [`architecture-boundaries.md`](./architecture-boundaries.md), layering rules for `src/lib/turn/` and API routes.
- Design docs under `docs/design/` for simulation invariants (elections, turn order, NPP, etc.).
