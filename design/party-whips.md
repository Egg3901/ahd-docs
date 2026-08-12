# Party Whips

The whip system lets parties and caucuses coordinate both player and NPP voting
without turning every vote into a hard override.

## Overview

Whips currently live on:

- national party `Whip Room`
- state / regional party `Whip Room`
- caucus `Whip` tab
- bill detail `Whip Panel`

Whips are stored in `billWhips` and can target either:

- `character` audiences
- `npp` audiences

## Scope

### National Party

National party leadership can issue whips for:

- federal chambers
- eligible local chambers where the national party still has whip authority

### State / Regional Party

State / regional leadership can issue whips for NPPs in their own geography.

### Caucus

Caucus whips are scoped to caucus members only and behave like a smaller
internal whip bloc inside the national party.

## Player vs NPP Whips

### Player Whips

Player whips still support two modes:

- `soft` -> notification / guidance
- `hard` -> immediate forced vote write, though the player may later change it

### NPP Whips

NPP whips are intentionally different:

- they interact with autonomous NPP behavior
- `soft` and `hard` affect NPPs differently
- they now feed the live bill-voting model instead of relying on a single old
  compliance threshold

## NPP Bill Whips

### Hard Bill Whips

Hard NPP bill whips are the strong tool.

- they perform a hidden loyalty / stubbornness success roll
- on success, the vote is written immediately in the whip direction
- on failure, the NPP falls back to its normal autonomous bill-voting logic

The hidden roll is intentionally generous so same-party NPPs usually comply,
while stubborn or disloyal NPPs still have a real chance to balk.

### Soft Bill Whips

Soft NPP bill whips are advisory.

- they do **not** immediately force an NPP vote
- instead they add weaker pressure into the NPP's autonomous cross-pressure
  bill-voting verdict

Soft whips are meant to tip close calls, not fully dominate neutral NPPs by
themselves.

## Autonomous Bill-Vote Pressure

When an NPP votes on a bill autonomously, whip pressure is one signed force in
the larger cross-pressure model alongside:

- ideology
- home-state / home-region sentiment
- donors

Whip pressure currently follows these intended rules:

- `hard` party bill whips keep the stronger legacy magnitude
- `soft` party bill whips use a lower advisory magnitude
- local/state whips take precedence over national whips where both could apply
- caucus bill whips remain scoped to caucus members only

## Leadership Elections

US congressional leadership elections are currently **player-only** in live NPP
behavior.

- NPPs do not autonomously vote in Speaker, House leadership, or Senate
  leadership elections
- NPP leadership whip helpers still exist in shared code, but NPP congressional
  leadership voting is not part of the desired current ruleset

Player-facing whip surfaces may still include leadership coordination for player
votes. The important intended rule is that **NPP congressional leadership votes
are not an active simulation system right now**.

## Defiance

Whip history is intentionally modeled as a **defiance watch**, not a permanent
compliance ledger.

### What Appears

Only active non-compliance is shown:

- the whip exists
- the target has cast a vote
- that vote currently contradicts the whip

### What Clears It

An active defiance entry disappears when:

- the target changes back into compliance
- the whip becomes irrelevant
- the underlying target closes or is withdrawn

That keeps the surface focused on who is **currently** defying the line, not on
permanent historical shame.

## Access Patterns

Current intended access:

- party members can see the internal whip room on pages they are authorized to
  access
- state / regional whip rooms are local-scoped
- caucus whip tooling is available from the caucus surface

## Related Docs

- [bills-legislation.md](./bills-legislation.md)
- [caucuses.md](./caucuses.md)
- [npp-system.md](./npp-system.md)
- [parties.md](./parties.md)
