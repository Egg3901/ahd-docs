# Prime Minister No-Confidence Vote

## Overview

This system is **country-agnostic**, not UK-only. It applies to any parliamentary country whose confidence-vote mechanism is enabled (`assertConfidenceVoteMechanism`), which today covers the UK and other parliamentary head-of-government countries. One-party states (e.g. China) have `confidenceVoteMechanism` disabled and are rejected at the route.

Members of the ruling party can propose a motion of no confidence in the sitting Prime Minister (or equivalent executive title). Any elected lower-chamber member of that country can then vote. If the motion reaches an absolute majority of the whole chamber, the PM is removed and government formation restarts.

**Location:** `src/lib/government/commands/parliamentaryGovernment.ts` (`proposeNoConfidence`, `castNoConfidenceVote`), `src/lib/turn/parliamentaryGovernment.ts` (`resolveParliamentaryNoConfidenceVote`, `noConfidenceMotionCarries`).

**Collection:** `noConfidenceVotes`

## Triggering a No-Confidence Vote

### Who Can Propose

Only a member of the **ruling party** (`canTriggerNoConfidence`, gated on the country's `governmentType`) can propose a motion. The proposer must be an elected member of the country's lower chamber (`getLowerChamberOfficeType(countryId)`).

- **Precondition:** Government must be `formed` with a sitting PM, and no vote already active (`govFormation.activeVoteId !== null` blocks a second motion).
- **Cooldown:** `NO_CONFIDENCE_COOLDOWN_TURNS = 48` turns since the last vote was proposed against this country (checked against the most recent `noConfidenceVotes` doc for the country, not per-PM).

### Proposing the Motion

1. Eligible lower-chamber member of the ruling party calls `POST /api/country/[code]/pm/no-confidence`.
2. A new `noConfidenceVotes` document is created with `status: "active"`, a 24-hour voting window, and the proposer's own vote is **not** auto-recorded (unlike the Speaker vacate-motion filer).
3. The sitting PM is notified: "{proposer} has proposed a vote of no confidence against you. {chamber} members will vote over the next 24 hours."

## Voting Process

### Eligible Voters

**Any elected member of the country's lower chamber can vote.** Voting is not restricted to the ruling party or coalition. Only proposing is restricted to the ruling party.

### Vote Duration

- **Duration:** `PM_VOTE_DURATION_HOURS = 24` hours from proposal (`src/lib/constants/governmentFormation.ts`)
- **Resolution:** Vote can resolve early once the passing threshold is reached, or at window close.

### Casting Votes

Votes are cast as `"aye"` (remove PM) or `"nay"` (keep PM) via `POST /api/country/[code]/pm/no-confidence/[voteId]/vote`.

- Player members vote manually.
- NPP members are auto-voted along party lines as a final pass before resolution (`autoVoteNPPsForNoConfidence`), so benches that were never explicitly whipped still cast a seat-weighted vote. A government whose seats are entirely NPP-held cannot dodge the vote by inaction.
- Each vote is weighted by the member's `seatsHeld` (multi-seat constituencies), not one member = one vote.

## Resolution

`resolveParliamentaryNoConfidenceVote` recomputes the tally from the seat-weighted `computeParliamentaryGovernmentTally` (the single source of truth; in-memory counters on the vote doc are reconciled to match) and applies `noConfidenceMotionCarries`:

- **Threshold:** an **absolute majority of the whole chamber** (`majorityThreshold`, falling back to `floor(totalSeats / 2) + 1`), not a majority of votes cast. Abstentions and unvoted seats count against the motion by default. The government survives unless "aye" actually clears the chamber majority. This is deliberately different from the legislative cloture rule (3/5 of votes cast).
- Resolution is claimed atomically (`status: "active" → "passed"/"failed"` conditional write) so a race between the turn processor and an inline API resolve cannot double-resolve the same vote.

### If the Motion Fails

- PM retains office.
- Notifications sent; a new cooldown of 48 turns is stamped from this proposal.

### If the Motion Passes

- `unformGovernmentAndVacatePM` clears the PM, cabinet, and `currentOffice`, and re-arms the government-formation vacancy clock (96 turns).
- Seats-by-party and governing party are recomputed.
- The removed PM is notified: "You have been removed as {executive title} by a vote of no confidence ({votesFor} for, {votesAgainst} against)."
- Government formation restarts from scratch (new PM selection process), not a direct hand-off to a runner-up candidate.

## Database Schema

### Collection: `noConfidenceVotes`

Fields actually present on the document (from `proposeNoConfidence` / `castNoConfidenceVote`):

```ts
interface NoConfidenceVote {
  _id: ObjectId;
  countryId: CountryId;
  proposedByCharacterId: ObjectId;
  proposedByName: string;
  targetPmCharacterId: ObjectId;
  targetPmName: string;
  votesFor: number; // seat-weighted "aye" total
  votesAgainst: number; // seat-weighted "nay" total
  votes: Record<string, "aye" | "nay">; // characterId -> vote
  status: "active" | "passed" | "failed";
  openedAt: Date;
  closesAt: Date;
  closesOnTurn: number;
  closedAt: Date | null;
  turnProposed: number;
}
```

## API Routes

| Route                                                          | Method | Access                             | Purpose                    |
| ---------------------------------------------------------------- | ------ | ----------------------------------- | --------------------------- |
| `/api/country/[code]/pm/no-confidence`                          | POST   | Ruling-party lower-chamber member  | Propose a motion            |
| `/api/country/[code]/pm/no-confidence/[voteId]`                 | GET    | Any                                 | Get status of a vote        |
| `/api/country/[code]/pm/no-confidence/[voteId]/vote`             | POST   | Any lower-chamber member            | Cast a vote (`aye`/`nay`)   |

## Related Documentation

- [Parliamentary Government](./parliamentary-government.md), Government formation and the legislation freeze during pending formation
- [UK Elections](./uk-elections.md), Commons elections and initial PM selection
- [Elections](./elections.md), General election mechanics
