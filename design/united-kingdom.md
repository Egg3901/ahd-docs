# United Kingdom

The UK uses the same core sim as the US, **turns**, **actions**, **parties**, **metrics**, and **economy**, with regional and parliamentary rules adapted for Commons and the Prime Minister.

## Regions as "states"

UK gameplay uses **12 playable regions** (`UK_REGIONS` in `src/lib/constants/uk.ts`) for Commons elections and residency, 9 English NUTS1-style regions plus Scotland, Wales, and Northern Ireland, totaling **650 Commons seats**:

| Code | Region                  | Nation | Commons seats |
| ---- | ------------------------ | ------ | -------------- |
| LON  | London                   | ENG    | 75             |
| SEE  | South East England       | ENG    | 91             |
| SWE  | South West England       | ENG    | 58             |
| EAE  | East of England          | ENG    | 61             |
| EMI  | East Midlands            | ENG    | 47             |
| WMI  | West Midlands            | ENG    | 57             |
| YHU  | Yorkshire & the Humber   | ENG    | 54             |
| NWE  | North West England       | ENG    | 75             |
| NEE  | North East England       | ENG    | 27             |
| SCO  | Scotland                 | SCO    | 57             |
| WAL  | Wales                    | WAL    | 32             |
| NIR  | Northern Ireland         | NIR    | 18             |

Your character's **home state** field uses these region codes for UK players. Many actions (e.g. [[Canvassing]]) are restricted to that home region.

## House of Commons elections

- Each region runs its own **Commons** election cycle (perpetual scheduling once a cycle completes).
- Vote accumulation and **multi-seat proportional** allocation follow the same family of rules as the US House implementation (largest-remainder style allocation, minimum share thresholds, spoiler handling where configured).
- **Candidacy** is generally limited to your **home region**; party leaders may have broader options, check in-game election enter rules for your office.

Demographic **categories and groups** match the US model; regional flavor comes from population weights and leans, not from separate group IDs.

## Prime Minister and confidence

After regional Commons cycles resolve nationally:

1. **Seat totals** are summed across regions by party.
2. The **largest party** attempts to form a government; its leader is nominated as **Prime Minister**.
3. A **confidence vote** among MPs determines whether that PM is confirmed.

Sitting MPs from the **ruling block** may also trigger **motions of no confidence** against the PM. If a motion succeeds, the PM is removed and the game proceeds to a new confidence process. Use the in-game **UK Government** hub at `/executive/uk` (Downing Street, PM, cabinet, Commons composition, confidence votes; `/uk/government` redirects there) for current status, votes, and deadlines.

### Government Formation Logic

**Entry point:** `src/lib/turn/ukGovernmentFormation.ts` → `resolveUKGovernmentFormation()`

```typescript
// Seat tally from electedOfficials (officeType="commons", countryId="UK")
const seatsByParty = await tallyCommonsSeatsByParty(db);
const [governingPartyId, governingSeats] = ranked[0]; // Highest seat count

// Majority threshold: 326 seats (50% + 1 of 650)
const threshold = COUNTRY_CONFIGS.UK.coalitionThreshold; // 326

if (governingSeats >= threshold) {
  status = "formed"; // Majority government, auto-triggers confidence vote
  formationType = "majority";
} else {
  status = "minority_pending"; // Player must initiate minority government attempt
  formationType = "minority";
}
```

### Government Statuses

| Status             | Description                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `formed`           | Government is active with confirmed PM                            |
| `minority_pending` | Largest party lacks majority; player must initiate formation vote |
| `forming`          | Coalition negotiation in progress (future feature)                |

### Minority Government

There is no fixed minimum-seat threshold for attempting minority government formation. `resolveUKGovernmentFormation()` compares the largest party's seat count to `majorityThreshold` (326, 50%+1 of 650) only; falling short of that yields `minority_pending` at any seat count, and the player initiates the formation vote from there.

### PM Appointment

**Entry point:** `src/lib/turn/ukGovernmentFormation.ts` → `appointPrimeMinister()`

```typescript
// Clears any existing PM from both characters and NPPs
await db
  .collection("characters")
  .updateMany({ isUkPm: true }, { $set: { isUkPm: false, ukPmAppointedAt: null } });

await db.collection("npps").updateMany({ isUkPm: true }, { $set: { isUkPm: false } });

// Appoints new PM (character or NPP)
await db.collection<ParliamentaryGovernment>("parliamentaryGovernments").updateOne(
  { _id: "UK" },
  {
    $set: {
      pmCharacterId: characterId,
      pmNppId: nppId ?? undefined,
      pmName: characterName,
      status: "formed",
      formedAt: now,
    },
  }
);
```

### Confidence Vote Trigger

After majority formation or successful no-confidence, `triggerNextPMConfidenceVote()` initiates the confidence vote process (see [[uk-pm-no-confidence]]).

## UK Bill Lifecycle

**Entry point:** `src/lib/turn/ukBillLifecycle.ts` → `processUKBillLifecycle()`

UK bills have a simpler lifecycle than US bills:

| Phase                  | US Bills                      | UK Bills                        |
| ---------------------- | ----------------------------- | ------------------------------- |
| **Voting**             | Active in originating chamber | Active in Commons or Lords      |
| **Crossover**          | Must pass both chambers       | No bicameral crossover required |
| **Executive approval** | Presidential signature        | Royal Assent (automatic)        |
| **Enactment**          | After signature               | Immediate upon passage          |

### Per-Turn Processing

```typescript
// src/lib/turn/ukBillLifecycle.ts

// Find bills with expired voting windows
const expiredBills = await db
  .collection<Bill>("bills")
  .find({
    status: "active",
    votingEndsAt: { $lte: now },
    originChamber: { $in: ["commons", "lords"] },
  })
  .toArray();

// Check passage (simple majority)
const passed = didPass(bill.votesFor, bill.votesAgainst);

if (passed) {
  // Royal Assent is automatic, enacted immediately
  await db.collection<Bill>("bills").updateOne(
    { _id: bill._id },
    {
      $set: {
        status: "signed",
        passedOriginAt: now,
        enactedAt: now,
        updatedAt: now,
      },
    }
  );

  // Apply legislation effects
  await applyLegislationEffect(db, bill);
  await onBillEnacted(db, bill, currentTurn);
} else {
  await db
    .collection<Bill>("bills")
    .updateOne({ _id: bill._id }, { $set: { status: "failed", failedAt: now } });
}
```

### Notification

Bill sponsors receive notifications on enactment or failure via `notifyUKSponsor()`.

Timing and exact costs for some motions may be tuned in balance passes, rely on UI copy for live numbers.

## Related pages

- [[Getting Started]], Onboarding for any country
- [[Election Mechanics]], Shared primary/general concepts where applicable
- [[State-Level Power]], Analogies to governors / regional power
- [[Government Approval]], National and regional approval
- [[National Budget & Treasury]], UK treasury panels and public corporations
- [[Corporations]], FTSE-listed firms and UK sectors
