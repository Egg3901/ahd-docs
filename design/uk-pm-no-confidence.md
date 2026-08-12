# UK Prime Minister No-Confidence Vote

## Overview

Members of the ruling party/coalition can propose a motion of no confidence in the Prime Minister. Only MPs from the ruling party/coalition vote. If a majority votes "yes" (no confidence), the PM is removed and a new confidence vote is triggered to select a replacement.

## Triggering a No-Confidence Vote

### Who Can Propose

Any MP who is a member of the **ruling party or coalition** can propose a no-confidence motion against the current Prime Minister.

- **Eligibility:** Must be an elected Commons MP in the same party as the PM
- **Cost:** [TBD — recommend 5 actions + 10,000 funds to prevent spam]
- **Cooldown:** One no-confidence vote per PM per 48 turns (1 game year) — prevents repeated harassment

### Proposing the Motion

1. Eligible MP clicks "Propose No-Confidence" on UK Government page
2. Confirmation modal: "Are you sure you want to propose a motion of no confidence in [PM Name]? This will trigger a vote among ruling party MPs."
3. If confirmed, new `PmNoConfidenceVote` document created with `status: "active"`
4. Notifications sent to all ruling party/coalition MPs: "A motion of no confidence has been proposed against PM [Name]. Vote now."

## Voting Process

### Eligible Voters

Only MPs from the **ruling party or coalition** can vote on the no-confidence motion.

**Example:**

- **Ruling party:** Labour (320 seats)
- **Coalition partner:** Lib Dem (20 seats)
- **Eligible voters:** 340 MPs (Labour + Lib Dem)
- **Not eligible:** Conservative, SNP, other opposition MPs

### Vote Duration

- **Duration:** 24 hours (24 turns)
- **Voting window:** Opens immediately when motion is proposed
- **Resolution:** When 24 hours elapse, vote is tallied and resolved

### Casting Votes

MPs vote "yes" (no confidence) or "no" (confidence) via the UK Government page.

- **Player MPs:** Vote manually via UI (Yes/No buttons)
- **NPP MPs:** Vote automatically based on favorability toward PM:
  - Favorability ≥60: 90% vote "no" (support PM)
  - Favorability 40-59: 50% vote "no"
  - Favorability <40: 90% vote "yes" (remove PM)

### Vote Visibility

- **Vote counts visible:** Yes/No totals displayed live (e.g., "125 Yes / 180 No / 35 Not Voted")
- **Individual votes hidden:** Who voted which way is not shown (secret ballot)

## Resolution

When the 24-hour voting period ends:

### If Majority Votes "No" (Confidence Maintained)

- **Threshold:** >50% of ruling party/coalition MPs vote "no"
- **Result:** PM retains office; no-confidence vote fails
- **Notifications:** PM receives "You have survived the no-confidence vote"; proposer receives "The motion of no confidence has failed"
- **Cooldown:** New no-confidence vote cannot be proposed against this PM for 48 turns

### If Majority Votes "Yes" (No Confidence)

- **Threshold:** >50% of ruling party/coalition MPs vote "yes"
- **Result:** PM is removed from office immediately
- **Notifications:** PM receives "You have been removed as Prime Minister by a vote of no confidence"; all MPs notified
- **Next step:** New confidence vote triggered (same process as post-election PM selection — see [uk-elections.md](./uk-elections.md#prime-minister-selection-confidence-vote))

#### After PM Removal

1. `UKGovernment.pmCharacterId` set to `null`
2. Next-most senior MP from the ruling party is nominated as new PM candidate
3. Confidence vote triggered among **all Commons MPs** (not just ruling party)
4. If new candidate wins confidence vote (>326 yes votes), they become PM
5. If new candidate loses, next candidate nominated, repeat
6. If all candidates exhausted, government falls (hung parliament or early election — future implementation)

## Database Schema

### Collection: `pmNoConfidenceVotes`

```ts
interface PmNoConfidenceVote {
  _id: ObjectId;
  proposerId: ObjectId; // Character who proposed the motion
  pmCharacterId: ObjectId; // PM being challenged
  pmName: string; // Cached for display
  rulingParty: string; // Party of PM
  votesFor: number; // "Yes" (no confidence)
  votesAgainst: number; // "No" (confidence)
  mpVotes: Record<string, "yes" | "no">; // characterId -> vote
  eligibleVoters: ObjectId[]; // List of ruling party/coalition MP characterIds
  status: "active" | "passed" | "failed";
  openedAt: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Update: `UKGovernment`

Add field to track last no-confidence vote:

```ts
interface UKGovernment {
  _id: "current";
  pmCharacterId: ObjectId | null;
  rulingParty: string;
  lastNoConfidenceVoteAt?: Date; // For cooldown tracking
  // ... existing fields
}
```

## Turn Processing

### Phase: Process Active No-Confidence Votes

Each turn, if an active no-confidence vote exists:

1. **Record NPP votes** (if not yet voted) — deterministic based on favorability
2. **Check if voting period ended** (`now >= openedAt + 24 hours`)
3. **If ended, resolve:**
   - Count total votes for/against
   - Determine outcome (passed/failed)
   - Update `status` field
   - If passed: remove PM, trigger new confidence vote
   - If failed: PM retains office, stamp cooldown
4. **Send notifications** to all involved MPs

This phase runs in `src/lib/turn/ukGovernment.ts` → `processNoConfidenceVotes()`, called from `processTurn()` in `turnSystem.ts`.

## API Routes

### POST /api/uk/pm/no-confidence

Propose a new no-confidence motion.

**Auth:** Must be an elected Commons MP in the ruling party/coalition

**Body:** None (PM is implicit — current PM)

**Validation:**

- User is an elected Commons MP
- User's party matches ruling party or coalition
- No active no-confidence vote exists
- Last no-confidence vote was >48 turns ago

**Response:**

```json
{
  "success": true,
  "voteId": "507f1f77bcf86cd799439011"
}
```

### POST /api/uk/pm/no-confidence/[id]/vote

Cast a vote on an active no-confidence motion.

**Auth:** Must be an elected Commons MP in the ruling party/coalition

**Body:**

```json
{
  "vote": "yes" | "no"
}
```

**Validation:**

- User is an eligible voter (in `eligibleVoters` array)
- Vote is still active (`status: "active"`)
- User has not already voted

**Response:**

```json
{
  "success": true,
  "votesFor": 125,
  "votesAgainst": 180
}
```

### GET /api/uk/pm/no-confidence/[id]

Get status of a no-confidence vote.

**Auth:** Public (but vote breakdown hidden)

**Response:**

```json
{
  "vote": {
    "_id": "507f1f77bcf86cd799439011",
    "pmName": "John Smith",
    "rulingParty": "labour",
    "votesFor": 125,
    "votesAgainst": 180,
    "notVoted": 35,
    "status": "active",
    "openedAt": "2026-03-08T12:00:00Z",
    "closedAt": null,
    "userVote": "yes" // Only if user is eligible voter and has voted
  }
}
```

## UI Components

### UK Government Page (`/uk/government`)

Add **No-Confidence Panel** below PM info (only visible if ruling party MP):

```
┌─────────────────────────────────────────┐
│ Prime Minister: John Smith (Labour)      │
│ Ruling Party: Labour (320 seats)         │
│                                           │
│ [Propose Motion of No Confidence]        │ ← Button (if eligible)
└─────────────────────────────────────────┘
```

### Active No-Confidence Vote Panel

If an active vote exists, show above PM info:

```
┌─────────────────────────────────────────┐
│ ⚠️ Motion of No Confidence               │
│                                           │
│ Target: John Smith (Labour)               │
│ Proposed by: Sarah Jones                  │
│                                           │
│ Current Tally:                            │
│ ✅ Yes (No Confidence): 125               │
│ ❌ No (Confidence): 180                   │
│ ⏳ Not Voted: 35                          │
│                                           │
│ Time Remaining: 18 hours                  │
│                                           │
│ Your Vote: [Yes] [No]                     │ ← If eligible and not voted
│ Your Vote: ✅ Yes                         │ ← If already voted
└─────────────────────────────────────────┘
```

## Example Scenario

1. **Day 1:** Labour wins Commons election, John Smith becomes PM with 320 seats
2. **Day 45:** Labour MP Sarah Jones is unhappy with PM's policies; proposes no-confidence motion
3. **Voting opens:** 340 Labour+LibDem MPs notified; 24-hour voting window
4. **Player MPs vote:** 50 players cast votes (30 no, 20 yes)
5. **NPP MPs vote:** 290 NPPs auto-vote based on PM favorability (180 no, 110 yes)
6. **Day 46 (voting closes):** Final tally: 130 yes, 210 no
7. **Result:** No-confidence motion fails; John Smith retains office
8. **Cooldown:** No new motion can be proposed for 48 turns (1 game year)

## Related Documentation

- [UK Elections](./uk-elections.md) — Commons elections and initial PM selection
- [Elections](./elections.md) — General election mechanics
