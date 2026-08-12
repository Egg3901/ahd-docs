# Labour & Unions

The labour system models per-sector wage decisions as a first-class economic and political lever: explicit worker pay carved out of corporate maintenance costs, a macro feedback loop tying wages into unemployment/income/migration, an NPC unionization metric with strikes, and a full player-run union layer (recruit, strike, demand wages, endorse legislation, get busted or write union law). It ships as one graduated feature flag so every tier can be validated independently before the next unlocks.

**Entry point:** `src/lib/labour/featureFlag.ts` (`labourSystemMode`, `isLabourWagesEnabled()`/`isLabourMacroEnabled()`/`isLabourUnionsEnabled()`/`isLabourFullMode()`)


## Overview

- **Scope:** Per-`CorporateSector` wage economics, national/state macro metrics, NPC + player-run unions, union-law legislation
- **Target:** All player and NPC corporations; unions organize an entire (country, industry) pair, not individual sectors
- **Effects:** Corp profit margins, state `medianIncome`/`unemploymentRate`, international migration pull, strikes (revenue throttle), union treasury/membership, legislative NPI cost
- **Enactment:** Admin toggle (Admin → Economy → Labour) for the mode tier; in-game actions (wage slider, recruit, strike, bust, demand-wage, claim/resign) once a tier is live; `union_law` bill provisions once at `full`

## `labourSystemMode` tiers

One graduated flag on `GameConfig`, each tier a strict superset of the previous. Default `"off"`.

| Tier | Unlocks |
| --- | --- |
| `off` | Nothing — legacy flat `maintenance` cost, no labour fields read or written |
| `wages` | Explicit per-sector labor cost (profit-invariant at baseline), CEO wage-level slider (0.8×–1.5×), minimum wage (Kaitz ratio), automation tech effect |
| `macro` | Wage decisions feed `medianIncome` (Phillips-curve passthrough) and `unemploymentRate` (wage + automation pressure terms), and modulate international migration pull |
| `unions` | NPC-driven per-sector `unionization` (0-100), `unionPremium` labor-cost surcharge, strikes (trigger/concession/waitout) |
| `full` | Union-busting, union-law legislation, and the entire player-run union layer (claim/recruit/strike/demand-wage/resign/endorse) |

## Data model

```typescript
// src/lib/labour/laborCost.ts (LabourContext — assembled per corp turn)
interface LabourContext {
  wagesEnabled: boolean;
  unionsEnabled: boolean;
  fullEnabled: boolean;
  minWageRatioByCountry: Map<CountryId, number>;
  unionLawBiasByCountry: Map<CountryId, number>;
  ownedUnionMembershipPressureByKey: Map<string, number>; // key: `${countryId}|${sectorType}`
}
```

```typescript
// src/lib/db/types/corporation.ts (CorporateSector labour fields)
interface CorporateSector {
  // ...
  wageLevel?: number; // CEO slider, 0.8–1.5, default 1.0
  unionization?: number; // 0-100, NPC-driven trending stock (mode >= "unions")
  workerExpectationIndex?: number; // slow-trending real-wage expectation (strikes)
  strikeStartedAtTurn?: number | null;
  strikeCooldownUntilTurn?: number | null;
  bustingCooldownUntilTurn?: number | null; // mode >= "full"
}
```

```typescript
// src/lib/db/types/union.ts
interface Union {
  _id: ObjectId;
  countryId: CountryId;
  sectorType: CorporationType; // one Union per (countryId, sectorType) — unique index
  ownerId: ObjectId | null; // null = NPC/unmanned; source of truth for leadership
  treasury: number;
  membershipPressure: number; // 0-100, additive term into unionizationDriftTarget()
  lastCalledStrikeTurn: number | null;
  demandedWageLevel: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UnionEndorsement {
  _id: ObjectId;
  unionId: ObjectId;
  billId: ObjectId;
  stance: "endorse" | "oppose";
  createdAt: Date;
}
```

`Character.unionLeaderOf` is a **denormalized read cache** of `Union.ownerId`, mirroring the existing `factionId`/`caucusMemberships` pattern — reconciled on read (`reconcileUnionOwnerCache`/`reconcileUnionLeaderCache` in `src/lib/unions/unionReconciliation.ts`) rather than via a periodic sweep, since the one-leader/one-union invariant is far simpler than caucus membership.

## Phase 0-1 — wages (`labourSystemMode >= "wages"`)

Explicit per-sector labor cost carved OUT of `maintenance` (never added on top) — profit-invariant at the baseline wage multiplier. `SECTOR_LABOR_INTENSITY` (cost share of revenue) and `SECTOR_WAGE_LEVEL` (relative pay per worker) are separate tables in `src/lib/labour/laborCost.ts`, so minimum wage correctly bites labor-intensive/low-paid sectors (retail, agriculture) instead of labor-light ones (extraction). CEO wage slider: `WageLevelPanel.tsx`. Minimum wage: Kaitz ratio on `FederalBudget.minimumWageKaitzRatio`, admin-settable via Admin → Economy → Labour (`LabourAdminPanel.tsx`). Automation tech reduces labor cost via the existing tech-tree framework.

## Phase 2 (v2) — macro coupling (`labourSystemMode >= "macro"`)

Routes labour wage decisions into the existing `medianIncome` Phillips-curve node rather than wiring every downstream channel individually:

- **Migration pull:** per-state `labourWageIndex` (worker-weighted `wageLevel × minWageFloorMultiplier`, 1.0 = baseline) multiplies `economicPullFactor`'s output via `labourMigrationWageFactor()`, bounded `[0.7, 1.3]`, re-clamped to `[0.5, 1.5]` overall.
- **Income channel:** `labourWageIndexDelta` (this-turn minus prior-turn index, zero on cold start) feeds `wageGrowthAnnualPct` inside `medianIncomeNode.compute()` via `labourWageIncomePassthrough()`.
- **Jobs channel:** the same wage delta adds a capped unemployment pressure term (`labourUnemploymentWagePressure`, 1.5pp per index-point, ±1.5pp cap); a separate `automationIndexDelta` (worker-weighted `techEffects.laborCostMultiplier`) adds an inverted pressure term (`labourUnemploymentAutomationPressure`, 2.5pp coefficient) — automation cutting headcount is deliberately a different signal from wages cutting pay.

Convention: **Δ not level** for anything read into a compounding series (medianIncome, unemploymentRate) — a level term would march the series to its bound and pin there. Unionization itself is the exception (see Phase 5) because it's a target-trending stock, not a recursive series.

## Phase 5 — NPC unionization metric (`labourSystemMode >= "unions"`)

Per-sector `unionization` (0-100) drifts each turn toward a condition-driven target (`unionizationDriftTarget()` in `src/lib/labour/unionization.ts`), inputs: CEO `wageLevel` vs. state cost-of-living (`realWageIndex()`), state `unemploymentRate` (worker leverage), country minimum-wage Kaitz ratio, plus (once `full`) `unionLawBias` and owned-union `membershipPressure`. `unionPremium(unionization)` is a standing labor-cost surcharge, linear 0-15pp (`UNION_PREMIUM_MAX_PCT`), folded into `wageMultiplier` using the prior turn's persisted value (one-turn lag, consistent with the rest of the labour system).

## Phase 6 — strikes (`labourSystemMode >= "unions"`)

Per-sector bounded-duration event (`src/lib/labour/strikes.ts`). Triggers when `unionization > STRIKE_UNIONIZATION_THRESHOLD` (55, calibrated well under `unionizationDriftTarget()`'s composed ceiling — see the calibration note below) **and** a slow-trending `workerExpectationIndex` lags the current real wage by more than `STRIKE_EXPECTATION_GAP_THRESHOLD` (0.12). While active: revenue ×0.75 (`STRIKE_REVENUE_THROTTLE`), margin −8pp. Resolves via **concession** (gap closes to ≤0.04) or **wait-it-out** (`STRIKE_DURATION_TURNS`=4 turns, unionization +10). Cooldown (`STRIKE_COOLDOWN_TURNS`=12) is set on both resolution paths — that, plus the trigger/concession hysteresis gap and the slow expectation index, is what prevents an always-strike/never-strike equilibrium.

**Calibration note:** the trigger/gap pair is deliberately reachable through *purely political* levers (union-law bias, membership pressure) with zero real wage or employment stress, not just economic ones — this is intended (see `strikes.ts`'s docblock for the exact composed-ceiling math), not a miscalibration. No single factor alone crosses the threshold.

## Phase 7 — union-busting + union law (`labourSystemMode >= "full"`)

- **Busting** (`src/lib/labour/unionBusting.ts`, command `attemptUnionBusting.ts`, route `POST /api/corporations/[id]/sectors/[sectorId]/union-busting`): CEO action modeled on the whip-success pattern. Success chance starts at 60, drops with unionization, floored 20/ceilinged 80. Success drops `unionization` by 20pp **and ends any active strike** (clears `strikeStartedAtTurn`, starts the strike cooldown); backfire raises unionization by 15pp and leaves strike state untouched. Cash cost 50% of daily gross revenue (floor 1000). 12-turn busting cooldown either way. Rejected with 409 while the turn engine is mid-processing (`isTurnProcessingNow()` guard against a write race with the bulk corp-turn update).
- **Union law:** `UnionLawProvision { type: "union_law"; bias: number }` — a single signed axis (-50 right-to-work .. +50 collective-bargaining) written to `FederalBudget.unionLawBias`. Feeds `unionizationDriftTarget()` (weight 0.6, max ±30pp) and a country-adjusted strike-trigger threshold override — deliberately does **not** bias the strike concession/gap threshold, to preserve Phase 6's hysteresis invariant. Bill authoring is an explicit "Include union-law provision" checkbox (not inferred from `bias !== 0`), since 0 is a valid, legislatable reset to neutral. NPI (National Political Influence) cost counts union-law provisions the same as policy/subsidy provisions — a bill can't add bias-shifting provisions for free.

## Phase 8 — player-run unions (`labourSystemMode >= "full"`)

One `Union` per (countryId, sectorType); ownership computed on demand rather than a stored roster. Leader actions (`src/lib/unions/commands/unionActions.ts`, routes under `src/app/api/unions/[id]/*`):

| Action | Effect |
| --- | --- |
| `claim` | First-come leadership of an unowned (country, sector) pair; unique index prevents a concurrent double-claim (duplicate-key retry handled gracefully) |
| `recruit` | Spend treasury (`RECRUIT_COST`=500), diminishing-returns `membershipPressure` gain |
| `strike` | Force-starts a strike on every matching sector at/above `STRIKE_CALL_MIN_UNIONIZATION`(30) not already active/cooling; cost scales per matched sector; computes each sector's `workerExpectationIndex` at call time so the strike doesn't spuriously auto-resolve as an immediate concession |
| `demand-wage` | Sets a visible target `wageLevel`, surfaced to CEOs in scope as a banner |
| `endorse` | Records a bill stance (`UnionEndorsement`) — visibility-only, no vote-swing effect yet; shown on the union's own dashboard |
| `resign` | Leader-only; clears `ownerId`/`unionLeaderOf`, leaves treasury/membershipPressure untouched |

Per-turn processing (`src/lib/turn/unions/index.ts`, `"unionsTurn"` phase, runs immediately after `"corporationTurn"`): treasury "dues" trickle proportional to `membershipPressure`, flat pressure decay, and an inactivity auto-vacancy (leader inactive `INACTIVE_CEO_TURN_THRESHOLD` turns — the same constant and `User.lastActivity` signal the CEO-vacancy system already uses — has the union released back to NPC control). All union routes and the turn phase are gated on `isLabourFullMode()`; the leaderboard/dashboard pages (`src/app/unions/page.tsx`, `src/app/unions/[id]/page.tsx`) distinguish a disabled-feature/network error from the legitimate empty state.

## Turn-processing race safety

Any player-facing union/labour mutation that isn't purely additive (union-busting, recruit, strike-call) checks `isTurnProcessingNow(gameState)` (`src/lib/turn/processingLock.ts`) before writing, rejecting with 409 while the turn engine's bulk corp-turn write is in flight — reusing the existing `GameState.isProcessing`/heartbeat lock rather than retrofitting optimistic concurrency into the shared turn-processing code path.
