# UK Elections

## Overview

UK Commons elections use multi-seat proportional allocation (reusing US House system) with regional abstraction. Four UK regions (England, Scotland, Wales, Northern Ireland) each hold separate Commons elections. After Commons elections resolve, the largest party attempts to form a government via confidence vote.

## Commons Elections

### Structure

- **Election type:** `electionType: "commons"`
- **Scope:** One election per UK region
- **Regions (stored as `state` field):**
  - `"ENG"` — England (543 seats)
  - `"SCO"` — Scotland (59 seats)
  - `"WAL"` — Wales (40 seats)
  - `"NIR"` — Northern Ireland (18 seats)
- **Total seats:** 650 across all regions

### Vote Allocation

Commons elections reuse the US House multi-seat proportional system:

1. **Vote accumulation:** Same as US House — group-level competitive allocation, votes accumulate per turn
2. **Proportional seats:** Largest-remainder method (Hamilton method)
3. **Minimum share:** 20% of votes required to win seats (`MULTI_SEAT_MIN_SHARE`)
4. **FPTP spoiler effect:** Applies by default (unless `state.votingSystem = "rcv"` set per region)
5. **Major parties by region:**
   - England: Conservative, Labour
   - Scotland: Conservative, Labour, SNP
   - Wales: Conservative, Labour, Plaid Cymru
   - Northern Ireland: DUP, Sinn Féin, SDLP, UUP, Alliance

### Timing

- **Duration:** [TBD — recommend 144 hours total = 3 game years]
- **Primary:** [TBD — recommend 48 hours]
- **General:** [TBD — recommend 96 hours]
- **Perpetual:** New Commons elections spawn when previous cycle completes for each region

### Candidacy

- **Home region only:** Characters can only run for Commons in their home region (e.g., `homeState: "SCO"` can only run in Scotland Commons election)
- **Exception:** Party leaders from any region can run in any region (allows strategic candidacy)
- **Seats requested:** Candidates may request multiple seats (like US House)

## Demographics

UK regions use **the same demographics as US** — no customization needed.

- **Categories:** Race, gender, education, wealth, age, ideology (same 6 categories as US)
- **Groups:** Same groups as US (no UK-specific groups)
- **State demographics:** Each UK region (ENG, SCO, WAL, NIR) has its own `StateDemographics` document with group populations and leans (same structure as US states)

Regional variation is achieved by varying the **population percentages** and **lean values** for existing groups, not by creating new groups.

## Prime Minister Selection (Confidence Vote)

After Commons elections resolve, government formation is handled by `resolveUKGovernmentFormation()` in `src/lib/turn/ukGovernmentFormation.ts`.

### Step 1: Count Total Seats

Seats are tallied from `electedOfficials` where `officeType: "commons"` and `countryId: "UK"`:

```typescript
// src/lib/turn/ukGovernmentFormation.ts:42-54
async function tallyCommonsSeatsByParty(db: Db): Promise<Record<string, number>> {
  const officials = await db
    .collection<ElectedOfficial>("electedOfficials")
    .find({ officeType: "commons", countryId: "UK" })
    .toArray();

  const seats: Record<string, number> = {};
  for (const official of officials) {
    if (!official.party) continue;
    seats[official.party] = (seats[official.party] ?? 0) + (official.seatsHeld ?? 1);
  }
  return seats;
}
```

**Example:**

- Labour: 320 seats (180 ENG + 35 SCO + 28 WAL + 77 NIR)
- Conservative: 280 seats (300 ENG + 10 SCO + 8 WAL + 2 NIR)
- SNP: 48 seats (all Scotland)
- Lib Dem: 2 seats

### Step 2: Determine Government Type

The `parliamentaryGovernments` document (`_id: "UK"`) is created/updated with the formation result:

| Seats | Status               | Formation Type | Next Step                                                   |
| ----- | -------------------- | -------------- | ----------------------------------------------------------- |
| ≥ 326 | `"formed"`           | `"majority"`   | Trigger confidence vote if no PM exists                     |
| < 326 | `"minority_pending"` | `"minority"`   | Party can attempt minority government (requires ≥100 seats) |

**Threshold:** 326 seats (`COUNTRY_CONFIGS.UK.coalitionThreshold`)

**Minority attempt minimum:** 100 seats (≈15.38% of 650, `MINORITY_SEAT_FRACTION = 0.1538`) — informational; UI shows if party is too small

### Step 3: Confidence Vote

A confidence vote is triggered automatically for majority governments without a PM, or manually by minority governments:

- **Duration:** 24 hours (24 turns) — `UK_PM_CONFIDENCE_VOTE_DURATION_HOURS`
- **Eligible voters:** All 650 elected Commons MPs
- **Question:** "Does [Character Name] ([Party]) have the confidence of this House?"
- **Threshold:** >50% (326 MPs) vote "yes" to confirm

#### Vote Behavior (`src/lib/turn/ukGovernment.ts`)

**NPP MPs:**

| Condition                     | Yes Probability     |
| ----------------------------- | ------------------- |
| Same party as nominee         | 95%                 |
| Different party               | 5%                  |
| Whip directive issued         | 100% (follows whip) |
| Minority attempt (same party) | 100%                |

**Player MPs:** Vote freely via API (`POST /api/uk/confidence-vote/[id]/vote`).

#### Vote Types

| Type                 | Description                                    | Pass Condition                 |
| -------------------- | ---------------------------------------------- | ------------------------------ |
| `"normal"`           | Standard confidence vote (majority government) | >50% of all MPs                |
| `"minority_attempt"` | Minority government attempt                    | ≥100 votes (≈15.38% threshold) |

### Step 4: Resolution

#### If Confidence Vote Passes:

1. `appointUKPrimeMinister()` called with nominee characterId/nppId
2. Previous PM cleared from both `characters` and `npps` collections
3. UK cabinet cleared via `clearCabinetOnTransition(db, "UK")`
4. Cabinet cooldowns reset
5. `parliamentaryGovernments` updated: `status: "formed"`, `pmCharacterId`/`pmNppId` set
6. Notifications sent to nominee and all MPs
7. Discord webhook announcement via `sendUKGameEvent()`

#### If Confidence Vote Fails:

1. `triggerNextPMConfidenceVote()` called with excluded candidate
2. Next-largest party's leader nominated
3. New confidence vote triggered
4. Process repeats until PM confirmed or all parties exhausted

#### Minority Attempt Failure:

- `parliamentaryGovernments.status` reset to `"minority_pending"`
- Player can retry with different nominee on subsequent elections

### Step 5: Government Formation Complete

Once a PM is confirmed, the UK government is formed. The PM serves until:

- Next Commons election (at end of 4-year cycle)
- No-confidence vote removes them (see [uk-pm-no-confidence.md](./uk-pm-no-confidence.md))
- Resignation

## Government Formation After No-Confidence

When a no-confidence vote passes, `checkAndInitiateUKFormation()` is called to re-evaluate the government status:

```typescript
// src/lib/turn/ukGovernmentFormation.ts:236-296
export async function checkAndInitiateUKFormation(now: Date): Promise<void> {
  // Re-tally seats, update parliamentaryGovernments status
  // If majority: status "formed", trigger confidence vote
  // If minority: status "minority_pending", player must initiate
}
```

This ensures the government document stays in sync with the current Commons composition.

## Database Schema

### Elections

Use existing `Election` collection:

```ts
{
  _id: ObjectId,
  countryId: "UK",
  electionType: "commons",
  state: "ENG" | "SCO" | "WAL" | "NIR",
  totalSeats: 543 | 59 | 40 | 18,
  cycle: number,
  status: "upcoming" | "active" | "completed",
  startTime: Date,
  endTime: Date,
  primaryEndTime: Date,
  durationHours: number,
  primaryDurationHours: number,
  createdAt: Date,
  updatedAt: Date
}
```

### Parliamentary Government

Collection: `parliamentaryGovernments` (used for all parliamentary countries: UK, CA, DE)

```ts
interface ParliamentaryGovernment {
  _id: "UK" | "CA" | "DE";
  countryId: CountryId;
  cycle: number; // Increments each election cycle

  status: "formed" | "minority_pending" | "forming";
  formationType: "majority" | "minority";

  pmCharacterId: ObjectId | null;
  pmNppId?: ObjectId; // Set if PM is an NPP
  pmName?: string;

  governingPartyId: string; // Party sequentialId
  totalSeatsSupporting: number;
  majorityThreshold: number; // 326 for UK
  isMinority: boolean;

  seatsByParty: Record<string, number>; // partyId -> seats
  totalSeats: number; // 650 for UK

  formedAt?: Date;
  formedTurn?: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Confidence Vote

Collection: `confidenceVotes` (shared across parliamentary countries)

```ts
interface ConfidenceVote {
  _id: ObjectId;
  countryId: CountryId;
  nominatedCharacterId: ObjectId; // Proposed PM/Chancellor
  party: string;
  votesFor: number;
  votesAgainst: number;
  mpVotes: Record<string, "yes" | "no">; // nppId or characterId -> vote
  voteType: "normal" | "minority_attempt";
  threshold?: number; // For minority_attempt (default: 100)
  status: "active" | "passed" | "failed";
  openedAt: Date;
  closesAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Legacy: `ukGovernment`

A legacy collection (`_id: "current"`) that stores `pmCharacterId` and `confidenceVoteId` for backward compatibility. The authoritative source is `parliamentaryGovernments`.

## Turn Processing

### Phase: Resolve Commons Elections

After general elections complete (`endTime <= now`), resolve Commons elections:

1. **Resolve each regional election** (ENG, SCO, WAL, NIR) using multi-seat proportional allocation
2. **Update elected officials** for each region
3. **Check if all 4 regions resolved** — if yes, trigger government formation

### Phase: Government Formation (`resolveUKGovernmentFormation`)

Runs in Group 8 (UK government) after election resolution:

1. **Tally seats** by party from `electedOfficials`
2. **Determine government type**: majority (≥326) or minority (<326)
3. **Update `parliamentaryGovernments`** with new cycle, status, seats
4. **Trigger confidence vote** if majority and no PM exists
5. **Discord announcement** via `sendUKGameEvent()`

### Phase: Confidence Vote Processing

Two functions in `src/lib/turn/ukGovernment.ts`:

- `processNoConfidenceVotes()` — Processes active no-confidence motions (Group 8)
- `processConfidenceVotes()` — Processes active PM confidence votes (Group 8)

Each turn, for active votes:

1. **Record NPP votes** — Deterministic based on party/whip
2. **Check expiry** — `now >= closesAt`
3. **Resolve** — Update status, appoint/remove PM, trigger next vote if needed

## API Routes

### Elections

Existing election routes apply to Commons elections:

- `GET /api/elections` — List all elections (includes Commons)
- `GET /api/elections/[id]` — Get Commons election detail
- `POST /api/elections/[id]/enter` — Enter Commons candidacy
- `POST /api/elections/[id]/withdraw` — Withdraw from Commons race

### UK Government

- `GET /api/uk/government` — Get current PM, ruling party, seat counts, government status
- `GET /api/uk/confidence-vote/[id]` — Get confidence vote status, vote counts, user vote

### Confidence Voting

- `POST /api/uk/confidence-vote/[id]/vote` — Cast vote (yes/no) on confidence motion
  - Body: `{ vote: "yes" | "no" }`
  - Auth: Must be an elected Commons MP
  - One vote per MP per confidence vote

### Minority Government

- `POST /api/uk/government/minority-attempt` — Initiate minority government confidence vote
  - Body: `{ nomineeCharacterId: string }`
  - Auth: Must be national chair of governing party
  - Requires: `status: "minority_pending"`, party has ≥100 seats

## UI Components

### Commons Elections Page (`/uk/commons`)

- **Seat breakdown by party** (pie chart or bar chart)
- **Seat breakdown by region** (table: party rows, region columns)
- **Current election status** (primary/general/upcoming)
- **Link to each regional election detail** (`/elections/[id]`)

### UK Government Page (`/uk/government`)

- **Current Prime Minister** (name, party, portrait)
- **Ruling party** (seat count, majority status)
- **Active confidence vote** (if any) — vote yes/no
- **Cabinet** — list of current cabinet ministers

### Confidence Vote Panel (on `/uk/government`)

- **Nominated PM:** [Character Name] ([Party])
- **Question:** "Does [Name] have the confidence of this House?"
- **Current tally:** [X] Yes / [Y] No / [Z] Not voted
- **Your vote:** [Yes] [No] buttons (if player is MP)
- **Time remaining:** [N] hours

## Cabinet Transition on Government Change

When a new PM is appointed (confidence vote passes) or a sitting PM is removed (no-confidence vote passes), the entire UK cabinet is cleared automatically:

- All cabinet members are dismissed
- Pending cabinet nominations are withdrawn
- Player characters who held cabinet positions receive a "Cabinet Resigned" notification

**Implementation:** `src/lib/cabinetTransition.ts` → `clearCabinetOnTransition(db, "UK")`

Called from:

- `src/lib/turn/ukGovernmentFormation.ts` (`appointUKPrimeMinister`) — on new PM appointment
- `src/lib/turn/ukGovernment.ts` (`processNoConfidenceVotes`) — on no-confidence vote passage

## Regional Council Elections

Each of the 12 UK regions has an elected **Regional Council** with seats based on real-world local government council counts (364 total). Elections use proportional multi-seat allocation with a 10% eligibility threshold, synchronized to the Commons cycle (480h duration, 72h primary/general).

- **Election type:** `"regionalCouncil"`
- **Spawning:** `ensureUKRegionalCouncilElections()` in `src/lib/turn/perpetualElections.ts`
- **Seat counts:** `UK_REGIONAL_COUNCIL_SEATS` in `src/lib/constants/states.ts`
- **Office type:** `{ type: "regionalCouncil", state: "UK_LON", seatsHeld: number }`
- **Mutually exclusive with Commons** — winning one vacates the other
- **Regional legislation:** Councillors propose and vote on regional bills via the `StateBill` system. Bills auto-enact on passage (no governor veto).
- **NPP participation:** NPPs enter elections and vote on regional bills using `getMajorPartiesForRegion()` for party distribution.

## Future Enhancements

1. **Coalition negotiation system** — Formal coalition agreements between parties
2. **Early elections** — Trigger new Commons election if government falls
3. **Prime Minister's Questions (PMQs)** — Weekly Q&A session in Commons
4. **Devolved elections** — Scottish Parliament (Holyrood), Welsh Senedd (separate from Regional Council)

## Related Documentation

- [UK PM No-Confidence](./uk-pm-no-confidence.md) — Removing a sitting PM
- [Elections](./elections.md) — General election mechanics
- [Vacancy Handling](./vacancy-handling.md) — UK MP vacancies
