# Turn Processing Submodules

## Overview

Turn processing is organized into 14 groups with 40+ phases. Submodules in `src/lib/turn/` handle specific domains: party organization, election resolution, NPP behavior, and corporation turn processing.

**Location:** `src/lib/turn/`

**Subdirectories:**

- `partyOrg/` - Party organization turn processing
- `election/` - Election resolution phases
- `npp/` - NPP behavior and actions
- `corporation/` - Corporation turn processing

## Group 7: Election Resolution (Sequential)

Group 7 is **strictly sequential** - ordering is critical for correct election results.

### Phase Order

```
1. Primary resolution
2. Vote accumulation
3. Timer advancement
4. Vote snapshots
5. General resolution
6. Leadership vacate
```

**Why Sequential:**

- Primaries must resolve before vote accumulation (winners advance to general)
- Votes must accumulate before timers advance (turn count affects election end)
- Timers must advance before elections resolve (expired elections end)
- General resolution must happen before leadership vacate (seat changes affect eligibility)

### Election Submodule Files

| File                     | Purpose                                   |
| ------------------------ | ----------------------------------------- |
| `seatAllocation.ts`      | Multi-seat allocation (Largest Remainder) |
| `voteTallying.ts`        | Vote counting and winner determination    |
| `candidateEnrichment.ts` | Candidate data enrichment                 |
| `primaryResolution.ts`   | Primary election resolution               |
| `generalResolution.ts`   | General election resolution               |

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

## Group 4: NPP Behavior (Parallel)

NPP behavior phases run in parallel after shared context loading.

### NPP Submodule Files

| File                  | Purpose                             |
| --------------------- | ----------------------------------- |
| `electionEntry.ts`    | NPP decisions on entering elections |
| `billVoting.ts`       | NPP voting on legislation           |
| `speakerVoting.ts`    | NPP voting for Speaker              |
| `actionProcessing.ts` | NPP action execution                |
| `actionAi.ts`         | AI decision-making for actions      |

### Shared Context Loading

```typescript
// All NPP phases use shared loadNPPContext()
const context = await loadNPPContext(db);
// Includes: elections, bills, parties, states, metrics
```

### Election Entry Logic

NPPs decide whether to enter elections based on:

- Ideology alignment with district
- Incumbent favorability
- Party whip directives
- Ambition vs loyalty personality traits

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

### Files

| File                                  | Purpose                           |
| ------------------------------------- | --------------------------------- |
| `sectorCalculations.ts`               | Sector profitability calculations |
| `expansion.ts`                        | Corporate expansion decisions     |
| `lobbying.ts`                         | Corporate lobbying activities     |
| `bankruptcy.ts`                       | Bankruptcy handling               |
| `debt.ts` - Corporate debt management |

### Sector Profitability

Corporations calculate profitability per sector:

```typescript
margin = baseMargin + debtToGdpMod + sectorModifiers + policyEffects
profit = revenue × margin
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

Each phase is wrapped in `runPhase()`:

```typescript
async function runPhase<T>(phaseName: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[Turn] Phase ${phaseName} failed:`, error);
    Sentry.captureException(error);
    return null; // Continue to next phase
  }
}
```

**Rationale:** A failure in one phase should not halt the entire turn. Errors are logged to Sentry for investigation.

## Phase Dependencies

### Invariants

| Group                   | Invariant                                            |
| ----------------------- | ---------------------------------------------------- |
| 1 (Resources)           | Parallel-safe: no cross-phase dependencies           |
| 1a (Finance)            | After corporations: bonds need updated liquidCapital |
| 2 (Demographics)        | Sequential: GOTV builds on party org                 |
| 7 (Election Resolution) | **Strictly sequential** - see above                  |
| 14 (Persistence)        | **Not wrapped in try/catch** - must succeed          |

### Data Flow

```
Group 1:  Action refresh → Fund generation → Corporation turn
          ↓
Group 1a: Bond coupons → NPP funds → Commodity prices
          ↓
Group 2:  Turnout decay → Party GOTV → Party org momentum
          ↓
Group 3:  Party elections → Party actions → Empty party cleanup
          ↓
Group 4:  NPP election entry → Bill voting → manual endorsement cleanup / leadership no-op
          ↓
...
Group 7:  Primary → Vote accumulation → Timer → General → Vacate
```

## Testing

Turn submodules have co-located tests:

```typescript
src / lib / turn / partyOrg / emptyPartyCleanup.test.ts;
src / lib / turn / election / seatAllocation.test.ts;
src / lib / turn / npp / billVoting.test.ts;
```

**Test patterns:**

- Use `MockDb` from `src/lib/test-utils/mockDb.ts`
- Test with multiple countries (US, UK, DE)
- Verify country safety (no cross-country collisions)

## Related Systems

- **Turn System:** `src/lib/turnSystem.ts` - Main orchestrator
- **Cron:** `src/lib/cron.ts` - Scheduler
- **Party Influence:** `docs/design/party-influence.md` - Party mechanics
- **Election Engine:** `docs/design/election-engine.md` - Vote calculations
- **NPP System:** `docs/design/npp-system.md` - NPP behavior
