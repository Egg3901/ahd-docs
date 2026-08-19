# Turn Processing Submodules

## Overview

Turn processing runs as **13 top-level adapters** (12 defined inline in `getTurnPhaseRegistry()` plus `stateEffectsAndNationalAggregationPhase`, imported from `stateEffectsPhase.ts`), each wrapping many individually error-isolated **phases** via `runtime.runPhase()`. Across the registry there are **105 `runPhase()` calls**. Submodules in `src/lib/turn/` handle specific domains: party organization, election resolution, NPP behavior, and corporation turn processing.

**Location:** `src/simulation/phases/turnPhaseRegistry.ts` (adapter registry), `src/lib/turn/` (domain submodules)

**Subdirectories under `src/lib/turn/`:**

- `partyOrg/` - Party organization turn processing
- `election/` - Election resolution phases
- `npp/` - NPP behavior and actions
- `corporation/` - Corporation turn processing
- `elections/`, `billLifecycle/`, `charters/`, `extraction/`, `history/`, `politicalStrength/`, `prospecting/`, `state/`, `unions/`, `worker/` - other turn domains

## Adapter Registry

`getTurnPhaseRegistry()` returns an ordered array of `TurnPhaseAdapter` objects, each with a `key` and an `execute(context, runtime)` function. The 13 adapters, in order:

| Key                                     | Purpose                                                              |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `expiredBannedShareholderCleanup`       | Releases shares of banned shareholders back to float                  |
| `inactiveShareholderShareRelease`       | Releases user- and corp-held shares of inactive accounts               |
| `resourceAndFinanceStart`                | Disasters, crises, auto-sector-seed, extraction strategy, fund gen, corporation turn |
| `demographicsAndPartySetup`              | Turnout decay, GOTV, party org, party elections, empty-party cleanup   |
| `billsCampaignsAndActivity`              | Bill lifecycle, NPP behavior, cabinet nominations, SCOTUS, campaign activity |
| `electionResolutionAndGovernment`        | **Strictly sequential** election resolution (see below)               |
| `electionCoverageAndSuccession`          | Coverage effects, succession, post-election bookkeeping                |
| `fiscalYearBoundary`                     | Fiscal year rollover                                                  |
| `stateEffectsAndNationalAggregation`     | Crisis turn (`processCrisisTurn`), ministerial orders, policy effects, demographic effects, metric/policy decay, subsidy budget (imported from `stateEffectsPhase.ts`, not inline in the registry array literal) |
| `indexFunds`                             | Index fund rebalancing                                                |
| `moneySupplySnapshot`                    | Money supply telemetry snapshot                                       |
| `ledgerBalanceSnapshot`                  | Ledger balance telemetry snapshot                                     |
| `ledgerReconcile`                        | Ledger reconciliation, **not error-isolated** - must succeed          |

Each adapter's `execute()` calls `runtime.runPhase(name, fn)` one or more times internally for its constituent phases; that is where the 105 total comes from. Adapter execution itself is sequential in registry order, top to bottom.

## `electionResolutionAndGovernment` (Sequential)

This adapter is **strictly sequential** - ordering is critical for correct election results. Comment in code: "Group 7 is strictly sequential. Reordering any of these steps corrupts elections by dropping final-turn votes or resolving offices from stale tallies."

### Phase Order (via `runPhase`)

```
candidatePartySweep
primaryResolution
voteAccumulation
campaignSpendReset
electionTimers
primarySnapshots
electionResolution
clearResolvedSupport
leadershipVacate
parliamentaryGovernmentFormation
parliamentaryGovernmentPhases
parliamentaryVacancyWatcher
nppGovernmentPhases
```

**Why Sequential:**

- Primaries must resolve before vote accumulation (winners advance to general)
- Votes must accumulate before timers advance (turn count affects election end)
- Timers must advance before elections resolve (expired elections end)
- General resolution must happen before leadership vacate (seat changes affect eligibility)
- Government formation runs after leadership vacate so seat/office changes are final

### Election Submodule Files

Real files under `src/lib/turn/election/` include (non-exhaustive): `seatAllocation.ts`, `sainteLagueAllocation.ts`, `blocListAllocation.ts`, `primaryResolution.ts` (imported from `src/lib/turn/primaryResolution`), `generalResolution.ts`, `generalResolutionHelpers.ts`, `contingentElection.ts`, `presidentResolution.ts`, `presidentContingentBallot.ts`, `presidentExecutiveSeating.ts`, `presidentialTenureLedger.ts`, `germanyAMS.ts`, `germanyLandtag.ts`, `electionSpawning.ts`, `electionNotifications.ts`, `ticketSplitCrossover.ts`, `commonsOrgRanking.ts`, `independenceDesireHook.ts`.

`voteTallying.ts` and `candidateEnrichment.ts` do not exist - there is no dedicated vote-tallying or candidate-enrichment file; that logic lives inside `generalResolution.ts`/`primaryResolution.ts`.

### Seat Allocation

```typescript
// src/lib/turn/election/seatAllocation.ts

export function allocateSeats(
  electionType: string,
  state: string | undefined,
  totalSeats: number,
  ranked: RankedCandidate[],
  totalVotesCast: number
): SeatAllocationResult {
  const isMultiSeat = MULTI_SEAT_TYPES.has(electionType);

  if (isMultiSeat) {
    // Largest Remainder (Hamilton method)
    // 1. Calculate exact seats per candidate
    // 2. Give everyone floor(exact)
    // 3. Distribute remainders to highest fractional parts
  } else {
    // Single seat: winner takes all
    winners = [[ranked[0].id, 1]];
  }
}
```

**Minimum Share Thresholds:**

- House: 20% (two-party dominance)
- State Senate: 10% (multi-party viable)

**Two-Seat House Special Case:**

```typescript
if (electionType === "house" && authoritativeSeats === 2) {
  if (eligible.length >= 2) {
    // Split 1-1 if two candidates meet threshold
    seatsEstimate[eligible[0].id] = 1;
    seatsEstimate[eligible[1].id] = 1;
  } else {
    // Winner takes both if no opponent reaches threshold
    seatsEstimate[ranked[0].id] = 2;
  }
}
```

## `billsCampaignsAndActivity` (NPP Behavior)

NPP behavior phases run inside this adapter after shared context loading.

### NPP Submodule Files

Real files under `src/lib/turn/npp/` include: `electionEntry.ts`, `billVoting.ts`, `stateBillVoting.ts`, `speakerRecalculation.ts`, `leadershipVoting.ts`, `whipResolution.ts`, `endorsements.ts`, `slateOverride.ts`, `slateResponse.ts`, `slateResponses.ts`, `challengerSupply.ts`, `crossPressure.ts`, `corpStrategy.ts`, `corpBehaviorConfig.ts`, `nppCorpTreasury.ts`, `nppProspecting.ts`, `nppSupplyAgreements.ts`, `marketSignals.ts`, `strategyExpectedRevenue.ts`, `billSponsorship.ts`, `context.ts`.

There is no `actionProcessing.ts` or `actionAi.ts`; NPP action/entry decisions are deterministic priority-based (see `docs/design/npp-opponents.md`), not a separate AI-decision module.

### Shared Context Loading

```typescript
// src/lib/turn/npp/context.ts
const context = await loadNPPContext(db);
// Includes: elections, bills, parties, states, metrics
```

### Election Entry Logic

NPP election entry is deterministic and priority-based (see `docs/design/npp-opponents.md` for the full ordering), not a random ambition roll. Broadly it weighs:

- Ideology alignment with district
- Incumbent favorability
- Party whip directives

### Bill Voting

NPPs vote on bills based on:

- Policy alignment with bill effects
- Party whip position
- Relationship with bill sponsor
- Constituent impact

## Party Organization Submodule

### `emptyPartyCleanup.ts`

**Purpose:** Delete parties with zero members.

**Collections Cleaned:**

- `politicalParties` - Party documents
- `statePartyOrg` - State organizations
- `partyBudget` - Party treasuries
- `statePartyElections` - State leadership elections
- `nationalPartyElections` - National leadership elections
- `nationalCommitteeElections` - Committee elections
- `billWhips` - Whip positions
- `coalitions` - Coalition memberships

**Country Safety:**

Uses composite keys to avoid cross-country collisions:

```typescript
// Build (countryId, partyId) pairs
const partyCountryPairs = emptyParties.map((p) => ({
  countryId: p.countryId ?? "US",
  partyId: String(p.sequentialId),
}));

// Query with $or to match both fields
await db.collection<StatePartyOrg>("statePartyOrg").deleteMany({ $or: partyCountryPairs });
```

**Member Counting:**

Parties are only deleted if they have zero:

- Characters (`characters` collection)
- Active NPPs (`npps` collection with `retiredAt: null`)
- Elected officials (`electedOfficials` collection)

```typescript
const emptyParties = nonDefaultParties.filter((p) => {
  const compositeKey = `${p.countryId ?? "US"}:${p.sequentialId}`;
  const charCount = charCountMap.get(compositeKey) ?? 0;
  const nppCount = nppCountMap.get(compositeKey) ?? 0;
  const officialCount = officialCountMap.get(String(p.sequentialId)) ?? 0;
  return charCount + nppCount + officialCount === 0;
});
```

**Coalition Handling:**

When a party in a coalition is deleted:

- If chair's party: pass chair to next most senior member
- If non-chair: remove from members list
- If last member: delete coalition entirely

## Corporation Turn Submodule

Corporation turn processing (`processCorporationTurn`) runs inside the `resourceAndFinanceStart` adapter, skipped entirely when `gameState.corporationActionsPaused === true`. Files live under `src/lib/turn/corporation/`.

### Sector Profitability

Corporations calculate profitability per sector:

```typescript
margin = baseMargin + debtToGdpMod + sectorModifiers + policyEffects;
profit = revenue * margin;
```

**Debt Modifier:**

- High national debt reduces sector profitability
- Applied uniformly across all corporations

### Expansion Logic

Corporations expand based on:

- Sector profitability
- Available capital
- Market saturation
- Regulatory environment

## Error Isolation

Each phase is wrapped by `runtime.runPhase()` in `src/simulation/engine/turnPhaseRuntime.ts`:

```typescript
async function runPhase<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const result = await Promise.race([
      runInAuditContext(traceId, () => withSpan(`turn.phase.${name}`, ..., () => fn()), { kind: "system" }),
      timeoutPromise,
    ]);
    // records completion breadcrumb, audit envelope, phase status
    return result;
  } catch (err) {
    console.error(`[Turn] Phase "${name}" failed: ${err.message}`, err);
    Sentry.captureException(err, { extra: { phase: name } });
    warnings.push(`${name}: ${err.message}`);
    return null; // Continue to next phase
  } finally {
    clearInterval(heartbeatTimer);
    clearTimeout(timeoutId);
  }
}
```

**Rationale:** A failure in one phase should not halt the entire turn. Each phase also has a per-phase timeout (`PHASE_TIMEOUT_MS`) and a heartbeat timer that refreshes the turn lock while long phases run. Errors are logged to Sentry and pushed onto a turn-level `warnings` array; mutating phases additionally get an audit envelope (`recordAudit`) with `outcome: "error"`.

The `ledgerReconcile` adapter is the one adapter that is **not** meant to silently swallow failure - a reconciliation mismatch is a data-integrity signal, not a routine phase error.

## Phase Dependencies

### Invariants

| Adapter                          | Invariant                                                          |
| ---------------------------------- | -------------------------------------------------------------------- |
| `resourceAndFinanceStart`          | Corporation turn skipped when `corporationActionsPaused`             |
| `demographicsAndPartySetup`        | Sequential: GOTV builds on party org                                 |
| `electionResolutionAndGovernment`  | **Strictly sequential** - see above                                  |
| `ledgerReconcile`                  | Runs last; discrepancies are a data-integrity signal, not routine    |

### Data Flow (high level)

```
expiredBannedShareholderCleanup → inactiveShareholderShareRelease
  ↓
resourceAndFinanceStart:   disasters/crises → auto-sector-seed → extraction strategy → fund gen → corporation turn
  ↓
demographicsAndPartySetup: turnout decay → party GOTV → party org → party elections → empty party cleanup
  ↓
billsCampaignsAndActivity: bill lifecycle → NPP behavior → cabinet nominations → SCOTUS
  ↓
electionResolutionAndGovernment: primary → vote accumulation → timers → general → vacate → government formation
  ↓
electionCoverageAndSuccession → fiscalYearBoundary → stateEffectsAndNationalAggregation (crisisTurn, policy effects, decay) → indexFunds → moneySupplySnapshot → ledgerBalanceSnapshot → ledgerReconcile
```

## Testing

Turn submodules have co-located tests:

```typescript
src / lib / turn / partyOrg / emptyPartyCleanup.test.ts;
src / lib / turn / election / seatAllocation.test.ts;
src / lib / turn / npp / billVoting.test.ts;
src / simulation / phases / turnPhaseRegistry.test.ts;
```

**Test patterns:**

- Use `MockDb` from `src/lib/test-utils/mockDb.ts`
- Test with multiple countries (US, UK, DE)
- Verify country safety (no cross-country collisions)

## Related Systems

- **Turn System:** `src/lib/turnSystem.ts` - Main orchestrator
- **Turn Phase Runtime:** `src/simulation/engine/turnPhaseRuntime.ts` - `runPhase()` error isolation
- **Cron:** `src/lib/cron.ts` - Scheduler
- **Election Engine:** `docs/design/election-engine.md` - Vote calculations
- **NPP System:** `docs/design/npp-system.md` - NPP behavior
- **NPP Opponents:** `docs/design/npp-opponents.md` - NPP entry priority ordering
