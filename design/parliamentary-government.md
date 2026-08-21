# Parliamentary Government

Current behavior for parliamentary-country government formation, head-of-government appointment votes, Votes of No Confidence (VONC), Confidence Motions, and the legislation freeze. It applies wherever `isParliamentarySystem(config)` is true: parliamentary monarchies, parliamentary republics, and one-party states. This includes the UK, Japan, Germany, Ireland, and one-party countries that seat a head of government through the shared path.

## Core collections

- `governmentFormations` (`_id: CountryId`), current government state. Key fields: `status` (`"pending" | "formed" | "collapsed"`), `pmCharacterId`, `pmName`, `governingPartyId`, `coalitionId`, `coalitionPartyIds`, `formationType`, `cycle`, `seatsByParty`, `pmVacancyDeadlineTurn`, `collapsedAt`, `formedAt`, `formedTurn`.
- `pmAppointmentVotes`, active / resolved PM appointment votes. 24h duration (`PM_VOTE_DURATION_HOURS`). Gains an `isConfidenceMotion?: boolean` flag in the S#17 work.
- `noConfidenceVotes`, active / resolved VONC docs targeting a sitting PM.

## Confidence Motion

When a lower-chamber general election resolves and the incumbent Prime Minister **retained their seat**, a **Confidence Motion** is auto-filed in the `pmAppointmentVotes` collection with `isConfidenceMotion: true`, the incumbent as nominee, and a 24h duration. The PM stays in office (`gov.status` remains `"formed"`) during the motion window.

Vote resolution branches:

- **Passes** (`votesFor > votesAgainst`) → PM stays. Concurrent alternative appointment votes are cancelled by the existing "first-to-pass cancels siblings" logic.
- **An alternative candidate's vote passes first during the motion window** → alternative is seated via `appointPrimeMinister`. When the confidence motion later resolves as failed, the resolver re-reads `governmentFormations`; because gov is already `formed` under the new PM, the motion's failed branch skips the vacate.
- **Fails with no alternative passed** → `unformGovernmentAndVacatePM` fires with `reason: "confidence-motion-failed"`. Gov goes `pending`, cabinet cleared, 96-turn vacancy clock re-armed, legislation freeze activates.

If the incumbent **lost** their seat in the election, no confidence motion is filed; the government stays `formed` with a seat-mismatch state until the next PM action (resignation, VONC, etc.).

NPP PMs: `pmCharacterId` is `null` for NPP-held PM seats, which means no confidence motion fires (the helper's `no-incumbent` guard).

Data-flow entry point: `runPostElectionGovernmentPhases` in `src/lib/turn/countryPhases.ts` → `openConfidenceMotionForIncumbent` + `updateSeatCountsOnly` (the latter refreshes `cycle` + `seatsByParty` + `governingPartyId` without touching PM state).

## Legislation Freeze

While `governmentFormations.status === "pending"` for a parliamentary country, legislation is strictly frozen:

- **Route-level gates** (return 400 with `"Government is in formation; legislation is frozen until a PM is seated"`):
  - `POST /api/country/[code]/legislature/bills` (bill proposal)
  - `POST /api/country/[code]/legislature/cabinet-bills` (cabinet bill proposal)
  - `POST /api/country/[code]/legislature/cabinet-bills/[id]/vote` (cabinet bill vote)
  - `POST /api/country/[code]/international-organizations/[orgId]/propose-leave` (propose leaving an international organization)
- **Turn-phase gates**: Country bill-lifecycle configs with `skipWhenGovPending: true`, including `UK_NATIONAL_CONFIG` and `JP_NATIONAL_CONFIG`, are skipped by `src/lib/turn/billLifecycle/engine.ts` while government is pending. Bills in flight stay in their current status until the freeze lifts.
- **NPP path**: NPP autonomous bill sponsorship (`src/lib/turn/npp/billSponsorship.ts`) calls `isLegislationFrozen` directly to skip the country during the turn loop, applying the identical rule as the HTTP gate so the two paths cannot drift apart.
- **Lift is automatic**: the next turn tick sees `gov.status === "formed"` and processes normally.

Non-parliamentary countries (US, CA) have no `governmentFormations.pending` state in normal play, so the freeze never applies. One-party states (DD, CN, RU) count as parliamentary for this purpose since they seat a head of government the same way, so they can be frozen too. DE (Germany) is a parliamentary country and is subject to the freeze; it is not exempt.

The shared gate helper is `checkLegislationFreeze(countryId)` in `src/lib/api/parliamentaryFreeze.ts`, which wraps the underlying rule `isLegislationFrozen(db, countryId)` in `src/lib/government/legislationFreeze.ts`.

## VONC-Parallel PM Nominations

PM appointment votes can be filed when **either**:

- `governmentFormations.status === "pending"` (classic post-election / post-collapse window), **or**
- `governmentFormations.status === "formed"` **and** an active VONC exists for the country (parallel-nomination window during a VONC).

Implementation: the gate in `src/app/api/country/[code]/pm/appoint/route.ts` checks both conditions; a 400 is returned only when neither is true.

### VONC resolution interaction

- **VONC passes** → incumbent removed, gov transitions to `pending` via `unformGovernmentAndVacatePM`. Parallel appointment votes keep running on their existing timers and resolve normally in the new pending window.
- **VONC fails** → the sitting PM survives. All active PM appointment votes for the country are cancelled (`status → "cancelled"`, `closedAt = now`) and each nominee receives a notification explaining why.

## Related systems

- [`snap-elections.md`](snap-elections.md), PM snap trigger, auto-snap deadline, dissolution slate-clearing.
- [`uk-pm-no-confidence.md`](uk-pm-no-confidence.md), VONC mechanics.
- [`bills-legislation.md`](bills-legislation.md), bill lifecycle + chamber transitions.
