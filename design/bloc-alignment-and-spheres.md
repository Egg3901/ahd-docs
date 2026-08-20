# Bloc Alignment and Spheres of Influence

## Overview

Alignment tracks how drawn each nation is toward each Cold War pole (0-100 shares that sum with an "uncommitted" remainder). Spheres of influence are the downstream effect: which patron a nation actually belongs to right now. Alignment is the cause, sphere membership is the effect, `sphereProjection.ts` is the seam between the two systems.

**Location:** `src/lib/alignment/`

**Key files:**

- `blocStress.ts` - Bloc-level strain gauge and its damping effect on bloc plays
- `sphereProjection.ts` - Projects pole shares onto sphere membership
- `crossing.ts` - Re-projects a nation's shares when the game crosses into a new alignment era
- `drift.ts` - Bounded passive per-turn movement
- `membershipEligibility.ts` - Join/leave thresholds for alignment-governed organizations
- `crisisCatalog.ts`, `crisisTurn.ts` - Flashpoint crises (see [crisis-system.md](./crisis-system.md#crisis-catalog-and-bloc-alignment-crisis-chains))
- `normalize.ts`, `project.ts` - Share normalization and lead/status derivation

## Bloc Stress

A bloc's own cohesion is modeled, not just its members' individual shares, an alliance that grabs half the map should not defend all of it as easily as a compact one. Stress is a 0-1 gauge (`computeBlocStress()`) built from three weighted components of the bloc's own membership:

| Component     | Weight | Meaning                                                                 |
| ------------- | ------ | ------------------------------------------------------------------------ |
| Contested     | 0.45   | Fraction of members where a rival pole holds `>= CONTESTED_RIVAL_MIN` (25) share |
| Wants out     | 0.35   | Fraction of members with `wantsOutSinceTurn` set (sustained-leave signal from `membershipEligibility.ts`) |
| Digesting     | 0.20   | Fraction of members that joined within `DIGESTION_WINDOW_TURNS` (12 turns) |

Raw member count is deliberately **not** an input, a large bloc of settled, uncontested members should not be penalized for size alone.

`blocPlayEffectiveness(stress)` returns a multiplier on the bloc's own plays: `1 - STRESS_MAX_DAMPING * stress`, where `STRESS_MAX_DAMPING = 0.4`. A fully-stressed bloc is impaired (60% effectiveness), never inert. `blocStressLabel()` buckets the gauge into `Settled` (<0.25), `Strained` (<0.6), or `Overextended` (>=0.6) for player-facing display.

## Sphere Projection

`projectSphereAlignment()` converts a nation's pole shares (0-100) into the sphere system's per-sponsor alignment scale (0-1), one entry per sponsored pole in the current era (including zero-share sponsors, so a lapsed patron shows as lapsed rather than disappearing).

`primarySphereFor()` determines which patron a nation is actually committed to: it takes the nation's top pole and requires `lead >= joinGateForPoleCount(poleCount)` (the same gate the alignment Ledger's bands use) before returning a sponsor. Below that gate, nobody has committed the nation and there is no primary sphere.

`applyAlignmentToMembership()` writes projected alignment through onto an existing `SphereMembership` document:

- Only relationships that already exist are updated, alignment does not create a new patron relationship (that is the `court` intent's job).
- `integration` (economic entanglement) is never touched by this, it is sphere-owned and lags political sympathy on purpose.
- The primary sponsor is only cleared when the membership shape allows it (no primary with 0-1 relationships); with 2+ relationships and no committed sponsor, it falls back to whichever surviving relationship has the highest alignment, so the record stays valid.

## Era Crossing

`applyEraCrossing()` re-projects a nation's pole shares onto the poles of a new alignment era, run exactly once per crossing (guarded by a stored era key so a long game converts cleanly instead of drifting between vocabularies or re-converting every turn).

- Every surviving pole is seeded at zero first, so a pole nobody inherits into (e.g. Beijing splitting off in a later era) reads as a real zero.
- A pole that survives the era transition keeps its own share.
- A pole that is superseded hands its share to its declared successor (`era.inherit[from]`).
- A pole with neither is dropped; `normalizeShares` returns that share to the uncommitted pool.

## Drift (Passive Movement)

Drift is bounded background movement, small enough that a deliberate influence play always outweighs it (`computeDrift()`, `src/lib/alignment/drift.ts`).

- A nation at or above `ALIGNMENT_GATES.locked` (85 lead) is immovable by drift; only a deliberate play can shift it.
- A nation in the non-aligned band (`lead <= ALIGNMENT_GATES.nonAligned`, 20) absorbs drift at half rate (`NON_ALIGNED_RESISTANCE = 0.5`), genuinely uncommitted countries are hard to move.
- Opposing pulls on different poles cancel **before** the per-turn cap applies, so only the net margin survives; allied pulls on the same pole simply add.
- The scaled result is capped by `PER_NATION_TURN_CAP = 5` share points per turn, or `CRISIS_TURN_CAP = 7.5` for a nation with an open crisis (see crisis chains).

### Membership Pull

Belonging to an alignment-channel organization exerts its own small passive pull toward that org's pole (`membershipPullForTurn()`):

- `MEMBERSHIP_PULL_PER_TURN = 0.04` share points per turn per unit of channel weight (roughly 1 point every 24 turns, half a game year, before weighting).
- Capped at `MEMBERSHIP_PULL_CEILING = 67` share points, membership alone can carry a nation to 67, never higher. Getting a nation past 67 (and up toward the 85 locked gate) requires deliberate plays, not just standing membership.
- The ceiling clamps only the passive component; a nation already carried past 67 by deliberate plays keeps every point, drift simply stops adding on top.

## Membership Eligibility

`standingFor()` (`membershipEligibility.ts`) answers whether a nation can join, or should leave, an alignment-governed organization, measured on the nation's **share** in that org's pole, not its overall lead.

- `JOIN_SHARE = 60`, share at or above which a nation may join.
- `LEAVE_SHARE = 40`, share at or below which a member is on its way out (`wantsOut`).
- Between 41 and 59 is a deliberate deadband: neither joining nor leaving, so a member doesn't flap in and out of its bloc on a few points of drift.
- `SUSTAIN_TURNS = 24` (half a game year), how long a nation must hold a threshold before the turn phase acts on it. This is also what feeds `wantsOutSinceTurn` into bloc stress and the defection-crisis trigger.
- The Non-Aligned Movement has no pole of its own; its "share" is the `nonAligned` remainder, evaluated against the same 60/40 thresholds.
- `governsMembership` is fail-closed: an org whose channel hasn't opted into `alignmentAccession` carries alignment influence but is not actually joined or left on alignment (e.g. the Commonwealth's former-empire association, the EU's own accession criteria).

## Related Systems

- [crisis-system.md](./crisis-system.md) - Flashpoint crises that raise a nation's movement ceiling while open
- International organizations and their alignment channels: `src/lib/constants/alignmentEras.ts`
