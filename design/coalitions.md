# Coalitions

Coalitions are country-scoped alliances between national parties. They are
still lighter than parties, but they are no longer just a nameplate plus invite
list.

## Core Purpose

Coalitions currently serve two different roles:

- **organizational alignment** between member parties
- **leadership-bloc aggregation** in the US chamber-leadership context

They are not a full party merge, and they do not replace party identity.

## Gameplay Effects

### US Chamber Leadership

Coalitions aggregate member-party seats into a bloc for U.S. congressional
leadership contexts.

- the largest bloc is the majority bloc
- the second-largest bloc is the minority bloc
- any member of any party in the bloc may participate in that bloc's leadership
  side

### Everything Else

Outside those leadership-bloc contexts, coalitions remain a lighter system.

They do **not** currently provide:

- treasury bonuses
- whip bonuses
- election bonuses
- general legislative vote overrides

## Formation and Membership

### Formation

- national party chairs can create coalitions
- a coalition is country-scoped
- the creator's party becomes the first member
- the creator becomes coalition chair

### Membership

Member parties can join through:

- chair-issued invites
- join requests

Leaving, kicking, succession, and disband votes all remain active parts of the
system.

## Priorities

Coalitions now have a real `Priorities` system rather than a placeholder tab.

### Priority Limits

- up to `3` active priorities at once

### Priority Types

Current supported priority types:

- `policy theme`
- `bill priority`
- `leadership goal`

### Visibility

Each priority is either:

- `public`
- `internal`

Public priorities are visible to everyone on the coalition page. Internal
priorities are intended for coalition members and admin-facing oversight.

### Governance

Coalition priorities use a party-vote model:

1. a coalition-side proposal is created
2. member-party chairs vote
3. the coalition adopts or rejects the proposal based on the member-party vote

This makes priorities a real coalition-governance layer instead of just a chair
note field.

### Cohesion

Coalitions also expose a `cohesion` summary.

Current intended meaning:

- `Strong`
- `Mixed`
- `Fractured`
- `Unaligned` when there are no active priorities

Right now cohesion is primarily a **health / alignment signal**, not a major
mechanical buff. It tells leadership whether coalition members are actually
lining up behind the same agenda.

## Disband Votes

Disband votes remain a live coalition mechanic:

- initiated by member-party leadership
- 24-hour voting window
- one vote per member party
- resolved by turn processing once expired

## Lifecycle and Cleanup

Coalitions are meant to clean themselves up correctly when the world changes.

Current intended lifecycle behavior:

- leaving or kicking updates membership immediately
- chair succession follows seniority if the chair party exits
- empty coalitions are deleted
- game reset clears coalition records and clears stale `coalitionId` links from
  surviving default parties

## UI

Current coalition page tabs:

- `Overview`
- `Parties`
- `Priorities`
- `Chair's Office` (chair only)
- `Admin` (admin only)

`Priorities` is no longer a placeholder; it is part of the intended system.

## Related Docs

- [parties.md](./parties.md)
- [npp-system.md](./npp-system.md)
