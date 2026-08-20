# Constitutional Convention

## Overview

The constitutional convention is the **voluntary** exit path from one-party rule, a player-initiated alternative to the forced Stage-4 collapse conversion described in [one-party-states-as-shipped.md](./one-party-states-as-shipped.md#constitutional-convention-the-voluntary-exit). A sitting leader announces a convention, negotiates a draft (target system, legacy-party seat reservation, election delay), and, if the draft is submitted in time, the regime converts to a parliamentary or presidential republic on a schedule the player chose rather than one collapse imposed.

**Location:** `src/lib/onePartyState/constitutionalConvention.ts`

Both the convention path and the forced Stage-4 path share the same conversion implementation (`triggerSystemConversion` in `systemConversion.ts`), differing only in `path: "voluntary"` vs `"forced"` and in how the terms (legacy reservation, election delay) are set.

## Three Phases

The convention is a small state machine stored on the country's regime-escalation document (`getRegimeEscalationCollection`), under a `convention` field.

### 1. `announced`

`announceConvention(db, countryId, leaderCharacterId, currentTurn)`, player-initiated.

Pre-conditions (throws otherwise):

- The country must have a regime-escalation state row (self-healed via `ensureInitialEscalationState` if missing, a fresh game with no per-turn driver run yet still allows the announce).
- `currentStage` must not be `"collapse"`. Once collapsing, the only paths out are Stage-4's `acceptPeacefully`/`resist` decisions or a forced conversion, layering a voluntary convention on top would race `checkForcedConversion` and produce an undefined outcome.
- No convention already in progress.

Effects:

- Sets `convention.phase = "announced"`, `announcedAtTurn = currentTurn`, `draftDeadlineTurn = currentTurn + DRAFT_PHASE_TURNS` (48 turns).
- Defaults `legacyReservation` to `cfg.legacyReservationDefault ?? 20` and `electionDelayTurns` to `cfg.electionDelayDefault ?? 24` (overridable in the next phase).
- Sets `conventionInProgress: true`, which **freezes the Stage-4 dwell counter** for the country's whole regime-escalation state.
- Applies `+15` popular legitimacy (`ANNOUNCE_POPULAR_BUMP`) and `-10` ruling-party confidence (`ANNOUNCE_INTRA_COST`), announcing a convention plays well with the public and badly with the party apparatus.
- Records a `regime_escalation` country-history event.

### 2. `draft`

`submitConventionDraft(db, countryId, draft, currentTurn)` locks the convention's terms and advances `announced` -> `draft`.

Input (`ConventionDraftInput`):

- `targetSystem: GovernmentType`, must be in the country's `collapseTargetAllowlist` (falling back to a single-value `collapseTargetSystem` if the allowlist is omitted on that country's config). Throws otherwise.
- `legacyReservation: number`, must be `0..35` (the design's negotiated range for guaranteed legacy-party seats after conversion).
- `electionDelayTurns`, must be one of `12`, `24`, or `48` (`VALID_ELECTION_DELAYS`), matching the UI-exposed picker values.

Also requires an in-progress convention already in the `"announced"` phase; throws if there is no convention or if it's already past that phase.

### 3. `ratification`

Not player-triggered, reached automatically by the per-turn tick once the draft phase deadline passes (see below). At `draftDeadlineTurn + electionDelayTurns`, the tick driver fires `triggerSystemConversion(db, countryId, currentTurn, {targetSystem, legacyReservation, path: "voluntary", electionAtTurn: currentTurn})`, which flips `governmentType` and parks the snap-election marker for the election engine. The convention field is then cleared and `conventionInProgress` reset to `false`.

## Per-Turn Auto-Transitions (`tickConventionPhase`)

Called from `processRegimeEscalationTurn`, before the dwell update (so `conventionInProgress` is correct for that tick):

- **`announced` + deadline passed without a draft** -> the convention is **abandoned**: `convention` field is unset, `conventionInProgress` reset to `false`, and a `"dissolves without a draft"` history event is recorded. Nothing else happens, the regime stays one-party and Stage-4 dwell resumes accumulating.
- **`draft` + `draftDeadlineTurn` reached** -> advances to `ratification`. No conversion yet.
- **`ratification` + `draftDeadlineTurn + electionDelayTurns` reached** -> fires the conversion (see phase 3 above). Defensive guard: if somehow `targetSystem` is missing at this point (should be impossible since draft submission requires it), the convention is dropped without converting rather than risking a bad cast.

## Design Notes

- The 48-turn draft window and the 12/24/48-turn election-delay choices give the player genuine room to negotiate before committing, but an abandoned announce costs nothing extra beyond the initial legitimacy/confidence trade, there's no penalty for announcing and then not following through.
- Freezing the Stage-4 dwell counter while a convention is in progress means a player can't be simultaneously racing toward a voluntary exit and getting overtaken by a forced Stage-4 collapse from the same underlying stress.
- Country config drives which target systems are reachable (`collapseTargetAllowlist`) and the negotiated defaults (`legacyReservationDefault`, `electionDelayDefault`), this is shared with the forced-conversion path so the two exits can't offer wildly different terms for the same country.

## Related Systems

- [one-party-states-as-shipped.md](./one-party-states-as-shipped.md) - Full one-party-state mechanics, including the forced Stage-4 collapse path and regime-escalation stages
- `src/lib/onePartyState/systemConversion.ts` - Shared conversion implementation (`triggerSystemConversion`)
- `src/lib/turn/regimeEscalationTurn.ts` - Per-turn regime-escalation driver
