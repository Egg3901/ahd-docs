# Performance hot paths and efficiency notes

This document captures **known high-impact execution paths**, **recent optimizations**, and **where deeper profiling belongs** for A House Divided. It complements `docs/engineering/repo-operating-map.md` and `claude.md`.

## Turn processing (`src/lib/turnSystem.ts`)

- **Orchestrator:** `processTurn()` loads all `characters` once per turn (`find({})`), then runs ~105 `runPhase` calls across ~12 groups. That full scan is load-bearing for action refresh and fund generation; reducing it would require semantic changes (e.g. "active only" definitions) and broader tests.
- **Game state:** `getGameState()` accepts an optional `Db` instance so callers that already have a connection avoid a redundant `getDb()` hop (same pool, fewer awaits). See `getGameState(db)` at `src/lib/turnSystem.ts`.
- **Group 7 ordering:** Election phases (primary resolution → vote accumulation → timers → general resolution) must stay **strictly sequential**. Do not parallelize for speed without new correctness tests.

## Election resolution (`src/lib/turn/electionResolution.ts`)

- **Completed elections:** `resolveGeneralElections` runs after elections reach `completed` status. It previously loaded the entire `politicalParties` collection to build an unused map; that query was removed, it did not affect outcomes, only I/O.
- **News:** `generateElectionNews` in `src/lib/news.ts` batches outcomes into one post per turn when multiple races resolve, good pattern; avoid per-race inserts in hot paths.

## Vote accumulation (`src/lib/turn/primaryResolution.ts`)

- **`accumulateGeneralElectionVotes`:** For non-presidential elections, each turn loads demographic preload and an approval map. `getAllStateApprovalsForElection({ countryIds })` now restricts `states` / `stateMetrics` queries to countries that actually have active state-level general elections, while still computing national averages **within** each country (same math as a full-world load for those countries).
- **Hypothesis:** Multi-country live games spend less CPU and less MongoDB scanned data on `stateMetrics` when only one country has concurrent races.

## NPP context (`src/lib/turn/npp/context.ts`)

- **`loadNPPContext`:** Performs batched parallel reads (NPPs, elections, bills, whips, parties, etc.). A second query loads active election IDs for candidacy tracking; merging it with the primary election query would trade one round-trip for different memory/network shapes depending on how many elections are in general phase, **left for profiling** before changing.

## UI and API

- **News page:** `src/app/news/page.tsx` is a server component, it fetches via `getDb()`/`getAuthUser()` server-side and delegates client interactivity to `NewsPageClient`. Auth-heavy layouts elsewhere may still duplicate `/api/auth/me` fetches client-side, consolidate only where product allows, to avoid double requests on first paint.
- **Large route surfaces:** ~1256 API routes under `src/app/api/`, performance work is most valuable on high-QPS or turn-adjacent routes, not one-off admin tools.

## Benchmarking and profiling (recommended next steps)

| Area                | Suggestion                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Turn total duration | Log or trace phase timings in `processTurn` (already has `durationMs` on `TurnLog`), compare before/after in staging with production-like data volume |
| MongoDB             | Atlas or `explain()` on `stateMetrics` / `states` with and without `countryIds` filter during peak election seasons                                    |
| React               | Next.js devtools / React Profiler on dashboard and news feeds with many posts                                                                          |

## Hot paths to leave unchanged until tests improve

- **Vote distribution math**, `src/lib/electionEngine/voteDistribution.ts`, `voteCalculations.ts`: small numeric changes alter election outcomes across the whole game.
- **Primary elimination and tally initialization**, `src/lib/turn/primaryResolution.ts` (`resolvePrimariesIfNeeded`): ordering and elimination rules are load-bearing.
- **Seat allocation and president resolution**, `src/lib/turn/election/seatAllocation.ts`, `src/lib/turn/election/presidentResolution.ts`.
- **Party org cleanup cascade**, `src/lib/turn/partyOrg/emptyPartyCleanup.ts`: cross-collection deletes; any batching change needs integration tests.

## Implemented optimizations (audit follow-up)

| Change                                                                   | Rationale                                                                              |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Optional `Db` for `getGameState`                                         | Removes redundant `getDb()` in `processTurn`, `initializeGameState`, `startTurnSystem` |
| Drop unused `politicalParties` read in `resolveGeneralElections`         | Full collection scan with no consumers                                                 |
| `getAllStateApprovalsForElection({ countryIds })` from vote accumulation | Smaller `stateMetrics` / `states` reads when not all countries have active state races |
