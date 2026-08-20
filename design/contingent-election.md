# Contingent Election

## Overview

The US 12th Amendment fallback when no presidential candidate reaches an Electoral College majority. The House elects the President; the Senate elects the Vice President. Source: `src/lib/elections/contingentElection.ts`.

This is not a raw 435-member roll call. Each **state delegation** casts one combined vote (26 states needed to win). Representatives only decide how their state's single delegation vote is cast. DC has electoral votes but no voting House delegation and is excluded from the House ballot. The Senate elects the VP on a one-vote-per-senator basis.

## Eligibility

| Chamber | Ballot | Candidates eligible |
| --- | --- | --- |
| House | President | Top 3 candidates by electoral vote (`getTopContingentPresidentCandidates`, ties broken by id) |
| Senate | Vice President | Running mates of the top 2 presidential tickets by EV (`getTopContingentVicePresidentCandidateIds`) |

`resolveContingentElection` throws if the presidential candidate list includes anyone outside the expected top 3 (`assertPresidentCandidatesEligible`).

## Thresholds

| Constant | Value | Meaning |
| --- | --- | --- |
| `HOUSE_CONTINGENT_THRESHOLD` | 26 | State delegations needed to elect President |
| `SENATE_CONTINGENT_THRESHOLD` | 51 | Senators needed to elect Vice President |
| `CONTINGENT_EXCLUDED_HOUSE_STATE` | `"DC"` | Excluded from the House delegation ballot |
| `CONTINGENT_HOUSE_STATE_IDS` | 50 states | Delegations with a House ballot (`Object.keys(HOUSE_SEATS).sort()`) |

If the Vice President ballot has exactly one eligible candidate, that candidate wins outright with no Senate vote. With two or more, the Senate votes.

## Voter Preference Model

Each House member and senator scores every eligible candidate:

```
score = (party match ? PARTY_MATCH_BONUS : 0) - ideologyDistance
ideologyDistance = |voter.economic - candidate.economic| + |voter.social - candidate.social|
```

`PARTY_MATCH_BONUS = 35`, kept modest so ideology distance (roughly 0-20) can still swing close races. `pickPreferredCandidate` returns the candidate with the best score; a voter-level tie is broken deterministically by hashing `tieSeed` with the sorted tied candidate ids (`sha256`, first byte mod tie-count).

NPP bloc officials can be aggregated into a single voter with a `weight` field (default 1) instead of one row per official.

## House Delegation Vote

`calculateHouseDelegationVote` sums each delegation's weighted picks per candidate. A delegation votes for the candidate with the strict majority of its own weighted picks; a delegation-level tie means that state abstains (`null`). DC always abstains. A delegation with zero eligible voters or zero eligible candidates also abstains.

`calculateHouseDelegationVotes` runs this across all delegations and returns per-state votes plus a candidate → delegation-count total (one point per state, not per representative).

## Senate VP Vote

`calculateSenateVpVotes` is a flat one-senator-one-vote tally over the eligible VP candidates using the same preference model, keyed with `tieSeed:senate:{senatorId}`.

## Winner Resolution

`resolveWinnerFromTotals` (shared by House and Senate):

1. Rank candidates by vote total, ties broken by id.
2. If the leader's total meets the chamber threshold (26 states / 51 senators), that candidate wins outright.
3. Otherwise **deadlock**: among the tied leaders, a deterministic hash of `electionId:deadlock:{context}:{sortedIds}` picks the winner (`sha256`, first byte mod tie-count). `deadlockBreakerUsed = true` and a `deadlockBreakerReason` string is recorded.
4. If the ballot produced **no votes at all** (every voter unable to pick, or an empty chamber), `resolveContingentEvFallback` breaks the tie by original electoral-vote count instead of chamber votes, with its own deterministic hash keyed `electionId:ev-fallback:{context}:{sortedIds}`.

## Result Shape

`ContingentElectionResult`:

| Field | Meaning |
| --- | --- |
| `resolutionMode` | `"contingent"` (threshold met outright) or `"contingent_deadlock"` (tiebreaker used, House or Senate or both) |
| `eligiblePresidentCandidateIds` / `eligibleVicePresidentCandidateIds` | The ballots actually run |
| `houseDelegationVotes` / `senateVotes` | Per-voter/per-state raw picks |
| `houseVoteTotals` / `senateVoteTotals` | Aggregated totals |
| `presidentWinnerId` / `vicePresidentWinnerId` | Final winners (`vicePresidentWinnerId` is `null` only if no running mates were eligible) |
| `houseThreshold` / `senateThreshold` | 26 / 51, echoed for display |
| `deadlockBreakerUsed` / `deadlockBreakerReason` | Whether and why a tiebreak fired |
| `topElectoralVoteTotal` | The winning EV count from the original election, for context copy |

## Determinism

All random-seeming choices (voter-level ties, delegation-level ties, chamber-level deadlocks, and the EV fallback) are `sha256`-hashed off `electionId` plus a context string, never `Math.random()`. The same election always resolves the same way if replayed.
