# Code Comment Standards

## When to Comment

Comment when a competent developer reading the code cannot immediately know WHY. Do not comment what the code does — comment why it does it that way.

**Comment these:**

- Game mechanic thresholds and balance decisions (why 65_000 as GDP baseline, why 0.5 as NPI accrual)
- Formula rationale (what real-world model does this approximate)
- Invariants a future editor must not break ("margin can go negative — this is intentional")
- Non-obvious ordering constraints ("primaries must resolve before vote accumulation")
- Defensive patterns ("recovers elections whose tally was finalized but never marked resolved")
- Parameter units where non-obvious (`gdpMillions: number // millions USD`)

**Do not comment these:**

- What control flow does (`// return early if array empty`)
- What an assignment does (`// set x to 1`)
- Historical bug-fix narratives longer than two sentences — put history in commit messages
- TODOs without an external task reference (use the task manager instead)

## WHY Comment Format (simulation lib)

Block comment above complex logic. Cover what the formula models, why thresholds exist, what invariants hold, what a future editor must not break. Reference the design doc if one exists.

Canonical style models: `src/lib/electionEngine/voteDistribution.ts`, `src/lib/archetypeAffinities.ts`

### Annotate parameter units inline:

```ts
function getCampaignFundCost(
  influence: number,
  gdpMillions: number, // millions USD (e.g. 289_500 = $289.5B)
  population: number
): number;
```

### Example of a good WHY comment:

```ts
// ── FPTP vote-splitting (spoiler effect) ─────────────────────────────────────
// Only applies in general elections (not primaries) in FPTP states when both
// third-party and major-party candidates are present in the same race.
// FPTP_SPOILER_RATE × third-party group allocation is transferred FROM the
// ideologically nearest major-party candidate TO the third party.
// Models real-world vote-splitting. Does NOT apply in RCV elections.
```

## Lightweight Route Header (API routes)

Every exported handler function gets exactly three lines immediately before the `export async function` declaration:

```ts
// POST /api/elections/[id]/vote — Cast a vote for a candidate in an active election
// Auth: requireAuth
// Errors: 400, 401, 403, 404
```

**Rules:**

- The auth line must match the actual auth helper used in the function body — do not write `requireAuth` if the route calls `requireAdmin`
- Error codes list every HTTP status the handler explicitly returns (not 500 from unhandled exceptions)
- One sentence purpose, plain English, present tense
- Public routes (no auth): `Auth: public`
- Cron routes: `Auth: requireCron`
- Admin-or-API-key routes: `Auth: requireAdminOrApiKey`

## What NOT to Do

```ts
// BAD — restates the code
const x = 1; // set x to 1

// BAD — obvious control flow
if (arr.length === 0) return; // return early if array is empty

// BAD — historical narrative (3+ sentences, belongs in git commit message)
// Fix for "House moving too fast": Previously we subtracted 1h from endTime
// each turn AND advanced now 1h per turn, causing 2h progress per turn → 96h
// completed in 48 turns. Now we do NOT subtract from timers...

// GOOD — trimmed to the invariant
// Timers are absolute timestamps; completion when endTime <= now (96h = 96 turns).
```
