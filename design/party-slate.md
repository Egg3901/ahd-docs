# Party Slate

## Overview

The Party Slate system gives national party leadership a central board for
planning who should run in each state or regional race.

It is a national-party planning and assignment surface, not a separate election
system. Slate helps party leadership:

- view every eligible race by state or region
- assign players or same-party NPPs to those races
- persist those assignments across cycles until manually changed
- coordinate candidate movement between same-state races

The current player-facing surfaces live under:

- the national party `Slate` tab
- each scoped state or regional party `Slate` tab

## Scope

Slate is designed around subnational and legislative races. Presidential races
do not use the Slate board.

The board renders as:

- a country map for countries with map support
- a selected-state or selected-region race list beneath that map

Scoped state or regional party views can render the same race list without the
national map.

## State / Region View

Each state or region can be selected from the map. Once selected, Slate shows
every currently relevant race in that geography.

The map is meant to answer:

- where the party has player or NPP presence
- which places currently have active Slate-relevant races
- where leadership should click to manage assignments

Current hover summaries focus on party presence and race counts rather than old
priority color signals.

## Race Cards

Each Slate race card currently includes:

- race name
- cycle / timing / phase context
- assigned candidates
- current assignment state
- integrated election phase strip
- embedded primary or general results when available

That embedded status data is intentionally sourced from the same shared election
display pipeline used on the state and election pages, so Slate does not invent
its own election-summary model.

## Assignment Authority

National and scoped state or regional party leadership can manage Slate assignments:

- `National Party Chair`
- `National Party Vice Chair`
- `State / Regional Party Chair` for races in that state or region
- `State / Regional Party Vice Chair` for races in that state or region
- admin override

Other players may still view Slate, but they cannot modify assignments.

Both the national page and the scoped state or regional page write into the same
underlying Slate rows, so assignments and notes stay synchronized across both
surfaces.

## Candidate Types

Slate supports assigning:

- player characters
- same-party NPPs

Assignments are specific to a race and geography.

## Player Assignments

When a player is assigned through Slate:

- the assignment appears on the board immediately
- the player receives an in-game notification
- the notification identifies the assigner and, when applicable, whether they
  are the `National Party Chair`, `National Party Vice Chair`, `State Party Chair`,
  or `State Party Vice Chair`

Slate itself does not auto-file the player into the race. The player still has
to enter the race through the election flow.

## NPP Assignments

NPP Slate behavior is relationship-free and instead uses discipline/compliance
stats.

### Compliance Rule

An NPP is considered Slate-compliant when:

- `loyalty >= 40`
- `stubbornness <= 70`

This threshold intentionally matches the current discipline-watch mental model.

### State / Regional Leadership Bonus

When a `State / Regional Party Chair` or `State / Regional Party Vice Chair`
issues the Slate assignment for a race in their own geography, the assigned NPP
gets a hidden compliance bonus:

- effective `loyalty` requirement reduced by `5`
- effective `stubbornness` ceiling increased by `5`

This bonus only applies to assignments made by scoped state or regional party
leadership. National leadership uses the baseline thresholds above.

### Acceptance Signal

Before turn resolution, Slate shows a prediction chip:

- `Likely to Accept`
- `Likely to Decline`

This is a forward-looking signal, not a resolved state.

### Resolved State

After turn processing:

- if the NPP actually enters the race, the chip becomes `Accepted`
- if the NPP fails to enter, the chip becomes `Declined`

That avoids showing resolved acceptance too early.

## Persistence

Slate assignments are intentionally persistent.

Assignments remain on the board:

- across turns
- after election processing
- into the next race cycle

They only change when party leadership manually updates or withdraws them, or
when a candidate actually files / resolves into a more specific state like
`Filed`.

## Same-State Candidate Movement

Slate is designed to support moving a candidate between races in the same state.

When leadership assigns a candidate to a new same-state race:

- older same-state Slate rows for that candidate are removed
- the new assignment becomes the current intended race

For compliant NPPs, the next turn can:

- withdraw them from an old active race if necessary
- file them into the newly assigned target race

If another same-party candidate already exists in that target race, the Slate
NPP can still join and create a contested primary rather than forcibly replacing
the existing entrant.

## Statuses

Slate currently uses statuses such as:

- `invited`
- `accepted`
- `declined`
- `withdrawn`
- `filed`

> `considering` is a deprecated legacy status. The NPP resolver no longer
> produces it (NPP responses are binary on compliance); the turn pass still
> re-evaluates any pre-existing `considering` rows so they resolve to
> `accepted` / `declined` by compliance.

### Pending vs Resolved

Fresh assignments should not immediately present themselves as fully resolved.

The important player-facing distinction is:

- pending assignment / pre-turn prediction
- filed or declined after actual turn resolution

## Withdrawing from Slate

Withdrawing a candidate from Slate is intended to remove that candidate from the
Slate slot rather than leaving behind a stale placeholder row.

If a candidate is withdrawn from one same-state race, they can then become
available again for another race in that state.

## Election Display Integration

Slate cards now embed:

- election phase status
- `Primary Results` when a race is in or coming out of primary
- `General Results` once the race is in general

This is meant to make Slate a planning tool that still reflects the live state
of the election calendar without forcing leadership to leave the page.

## Design Intent

Slate is meant to function as the party's campaign bench-management board.

It should help answer:

- which races need a candidate
- who leadership wants in each race
- whether an NPP is likely to cooperate
- what the race already looks like in primary/general terms

It is not meant to replace candidate filing, election pages, or direct player
campaign choices. It is a coordination layer above those systems.

## Related Docs

- [party-building.md](./party-building.md)
- [party-influence.md](./party-influence.md)
- [elections.md](./elections.md)
