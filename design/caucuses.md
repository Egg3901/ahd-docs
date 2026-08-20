# Caucuses

## Overview

Caucuses are opt-in sub-blocs inside a national party. They give players a way
to organize around a shared line, pool caucus funds, run caucus-specific whips,
and build a more disciplined internal faction without creating a separate party.

They are a **national-party-only** feature. State and regional party chapters do
not own caucuses.

## Core Structure

Each caucus has:

- a `name`
- a `description`
- an optional `motto`
- a `color`
- a `Chair`
- a `Vice Chair`
- a caucus `treasury`
- a caucus `Tax` rate from `0%` to `5%`
- a roster of player and NPP members
- a set of caucus policy positions

The current player-facing surface lives inside the national party page under the
`Caucuses` tab.

## Sub-Tabs

Each caucus currently exposes five sub-tabs:

- `Overview`
- `Roster`
- `Whip`
- `Elections`
- `Chair's Office` (Chair only)

## Membership

### Player Membership

Players can join or leave caucuses through the caucus membership flow. The caucus
roster shows both player and NPP members.

### NPP Membership

NPPs can be recruited into a caucus by the `Caucus Chair` through the
`Chair's Office`.

Current recruitment rules:

- NPP must be in the same party
- NPP must not be retired
- NPP must not already belong to another caucus
- the Chair must have at least `60` relationship with the NPP
- the caucus must not be on its 12-turn recruitment cooldown

The recruit menu intentionally hides:

- NPPs already in another caucus
- NPPs below the relationship threshold

So the picker only surfaces same-party NPPs that are actually in range to be
recruited once the caucus is off cooldown.

### Caucus-Wide Recruit Cooldown

Successful NPP recruitment triggers a **caucus-wide** cooldown of 12 turns (12h at standard cadence, freezes if the game is paused).

The UI always shows one of two recruitment states:

- `Recruitment Available`
- `Xh Ym cooldown`

This cooldown belongs to the caucus as a whole, not to an individual NPP.

## Relationship Maintenance

Caucus NPP membership is relationship-sensitive over time.

### Per-Turn Decay

Every stored NPP-to-character relationship drifts `0.1` toward neutral each turn:

- positive scores move down toward `0`
- negative scores move up toward `0`

This keeps one-off relationship gains from becoming permanent access to caucus
control, Slate leverage, or other NPP systems.

### Retention Threshold

After the decay pass, caucus NPPs are checked against the current Chair.

If an NPP's relationship with the Chair falls below `20`, the NPP automatically
leaves the caucus during turn upkeep.

This is intentionally much lower than the `60` recruit threshold, so caucus
membership is harder to earn than it is to maintain.

## Caucus Treasury

Caucuses maintain their own treasury and can tax caucus funds at `0-5%`.

Current caucus treasury controls in `Chair's Office`:

- edit caucus `Tax`
- send caucus funds to active caucus member players
- transfer caucus funds back to the parent national party treasury

These actions create treasury audit rows so caucus spending remains visible in
the broader party record.

## Caucus Whip

Each caucus has its own `Whip` sub-tab.

The caucus whip surface mirrors the main party `Whip Room`, but its scope is
limited to caucus members only.

Current behavior:

- `Players` and `NPPs` sub-tabs
- player `Soft` and `Hard` whip modes
- bill-by-bill whipping
- leadership whipping
- no standing-order-based caucus whip behavior in the current intended flow

See [party-whips.md](./party-whips.md) for the broader whip model.

## Caucus Chair Elections

Each caucus now has an `Elections` sub-tab where active caucus members can:

- view the active or most recent `Caucus Chair` election
- declare candidacy
- withdraw candidacy
- vote for the next caucus chair

### Schedule

Caucus chair elections run on the same cadence as the parent party's national
leadership cycle. In practice, caucus elections are anchored to the active
national `Chair` election window for the same party and country, so caucus
leadership turns over alongside party leadership.

### Participation Rules

- only active caucus player members may run or vote
- the same new-character cooldown used for party leadership elections applies
- NPPs do not run for or vote in caucus chair elections

### Resolution

When the election ends:

- the winning player becomes the new caucus `Chair`
- the outgoing chair's caucus membership role is demoted back to `member`
- the winner's caucus membership role is promoted to `chair`

Ties break toward the earliest declaration timestamp, matching the broader party
leadership election expectation.

## Chair's Office

The caucus `Chair's Office` is only visible to the current caucus `Chair`.

It is where caucus leadership manages:

- caucus identity fields (`name`, `motto`, `description`, `color`)
- caucus `Tax`
- caucus treasury sends and transfers
- NPP recruitment into the caucus

The NPP recruitment panel shows:

- the NPP's current relationship with the Chair
- the NPP's current office, if any
- caucus-wide recruitment cooldown state

## Caucus Health Dashboard

Party members get caucus-health visibility in two places:

- a high-level `Caucus Health` summary in the national party `Analytics` tab
- a richer per-caucus health view inside each caucus `Overview`

The health pass currently surfaces:

- a simple `Healthy`, `Strained`, or `Fragile` label for each caucus
- recent joins, leaves, and forced exits over the latest short turn window
- current caucus-whip defiance counts
- whether a caucus chair election is active
- NPP members who are drifting close to the Chair relationship exit threshold

## Policy Positions

Caucuses can define internal policy positions. These positions are intended to
signal what the caucus stands for inside the party and help support factional
identity beyond simple membership.

## Design Intent

Caucuses are meant to create:

- internal party faction play
- smaller whip blocs inside a large national party
- treasury and patronage decisions at a sub-party level
- relationship-driven NPP faction building

They are not meant to replace the national party itself, and they do not create
separate ballot lines or separate election parties.

## Related Docs

- [party-building.md](./party-building.md)
- [party-whips.md](./party-whips.md)
- [party-influence.md](./party-influence.md)
