# Crisis System

Crises are dynamic events that modify state metrics, government approval, and corporate profit margins across affected regions. They can be one-time shocks (flat effects) or ongoing situations (tick effects).

## Overview

- **Purpose**: Create dynamic economic/political events that challenge players and alter the game world
- **Scope**: Global, country-wide, or region-specific
- **Duration**: Fixed (N turns) or indefinite (manual resolution)
- **Effects**: State metrics, government approval, corporate profit margins
- **Turn Processing**: Runs inside the `stateEffectsAndNationalAggregation` adapter (`src/simulation/phases/stateEffectsPhase.ts`), via `runtime.runPhase("crisisTurn", ...)`

## Crisis Structure

### Core Fields (`crises` collection)

| Field                | Type                                    | Description                                                   |
| -------------------- | --------------------------------------- | ------------------------------------------------------------- |
| `name`               | string                                  | Display name (e.g., "Northeast Blackout", "Financial Crisis") |
| `description`        | string                                  | Full description of the crisis                                |
| `scope`              | `"global"` \| `"country"` \| `"region"` | Geographic scope                                              |
| `countryIds`         | CountryId[]                             | Affected countries (when scope = "country" or "region")       |
| `regionIds`          | string[]                                | Affected states/regions (when scope = "region")               |
| `status`             | `"active"` \| `"resolved"`              | Current status                                                |
| `startTurn`          | number                                  | Game turn when crisis activated                               |
| `endTurn`            | number \| null                          | Game turn when resolved (null while active)                   |
| `durationTurns`      | number \| null                          | Duration in turns; null = indefinite                          |
| `effects`            | CrisisEffect[]                          | Array of effect definitions                                   |
| `wireMessageOnStart` | string                                  | Wire event message when crisis starts                         |
| `wireMessageOnEnd`   | string \| null                          | Wire event message when crisis ends                           |

### Crisis Effect Structure

Each effect defines what changes and how often it applies:

| Field            | Type                                                                                       | Description                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `effectType`     | `"flat"` \| `"tick"` \| `"decay"`                                                           | **flat**: applied once on start turn only; **tick**: applied every turn while active, ramping down toward expiry; **decay**: currently skipped by `crisisTurn.ts` (reserved) |
| `targetType`     | `"metric"` \| `"approval"` \| `"profitMargin"` \| `"inflation"` \| `"gdpLoss"` \| `"stat"` | What the effect modifies                                                                  |
| `statKey`        | string \| undefined                                                                          | For `stat` effects: which character stat to target (charisma, debate, energy, etc.)       |
| `metricCategory` | string \| null                                                                                | Category name (e.g., `"economic"`), for metric effects                                   |
| `metricField`    | string \| null                                                                                | Field name (e.g., `"unemploymentRate"`), for metric effects                              |
| `sectorType`     | string \| null                                                                                | Corporation sector type filter, for profit margin effects; null = all sectors            |
| `strategyId`     | string \| null                                                                                | Operating strategy filter, for profit margin effects; null = all strategies              |
| `value`          | number                                                                                        | Effect magnitude. Negative = penalty; positive = bonus. Profit margin = percentage points. For `gdpLoss`, the fraction of regional GDP destroyed (e.g. 0.03 = 3%) |
| `physicality`    | `"physical"` \| `"financial"` \| undefined                                                  | For `profitMargin` effects under the plants market tier: `physical` reads `value` as a production haircut instead of a margin hit. Absent = `financial` (legacy margin-only) |
| `label`          | string                                                                                        | Display name for the effect (e.g., "Unemployment spike")                                  |

## Scope Resolution

Crises resolve their geographic scope to a list of target state IDs:

| Scope       | Resolution                                                 |
| ----------- | ---------------------------------------------------------- |
| `"global"`  | All states in all countries                                |
| `"country"` | All states in the specified `countryIds`                   |
| `"region"`  | Only the specified `regionIds` (state IDs like "CA", "TX") |

## Effect Types

### Flat Effects

Applied **once** on the turn the crisis starts (`turn === crisis.startTurn`):

```typescript
// Example: Sudden unemployment spike
{
  effectType: "flat",
  targetType: "metric",
  metricCategory: "economic",
  metricField: "unemploymentRate",
  value: 2.5, // +2.5% unemployment
  label: "Job losses"
}
```

### Tick Effects

Applied **every turn** while the crisis is active:

```typescript
// Example: Ongoing economic recession
{
  effectType: "tick",
  targetType: "metric",
  metricCategory: "economic",
  metricField: "gdpGrowth",
  value: -0.1, // -0.1% GDP growth per turn
  label: "Economic contraction"
}
```

### Tick Decay

Tick effects don't hold full strength for the crisis's whole life, for crises with a finite `durationTurns`, `tickDecayFactor()` (`src/lib/turn/crisisTurn.ts`) linearly ramps the applied `value` from 1.0x at `startTurn` down to 0x at expiry (50% at the midpoint):

```typescript
export function tickDecayFactor(turn: number, startTurn: number, duration: number | null): number {
  if (duration === null || duration <= 0) return 1;
  const elapsed = turn - startTurn;
  return Math.max(0, Math.min(1, 1 - elapsed / duration));
}
```

Indefinite crises (`durationTurns` null or <= 0) never decay, they apply their tick effects at full strength every turn until manually resolved.

## Target Types

### Metric Effects

Modify state metrics in the `stateMetrics` collection:

- **Path**: `stateMetrics.${metricCategory}.${metricField}.value`
- **Applies to**: All states in the resolved scope
- **Example categories**: `economic`, `social`, `infrastructure`
- **Example fields**: `unemploymentRate`, `gdpGrowth`, `crimeRate`

### Approval Effects

Modify government approval rating at the **country level**:

- **Collection**: `governmentApproval`
- **Field**: `approvalRating`
- **Deduplication**: Region-scoped crises derive the affected country from the region's parent country

```typescript
// Example: National crisis reduces government approval
{
  effectType: "tick",
  targetType: "approval",
  value: -0.5, // -0.5% approval per turn
  label: "Public discontent"
}
```

### Profit Margin Effects

Modify corporate sector profit margins in the `corporateSectors` collection:

- **Collection**: `corporateSectors`
- **Field**: `profitMargin` (clamped to [0, 100])
- **Filtering**: Can target specific `sectorType` and/or `strategyId`
- **Example**: Energy crisis hits energy-intensive sectors

```typescript
// Example: Power grid failure hits all sectors
{
  effectType: "tick",
  targetType: "profitMargin",
  sectorType: null, // all sectors
  strategyId: null, // all strategies
  value: -5, // -5% profit margin per turn
  label: "Power outage costs"
}
```

### Inflation Effects

Modify country-level inflation via `applyInflationEffects()`.

### GDP Loss Effects

One-time, real output destruction (physical-destruction disasters), applied only at `startTurn` regardless of `effectType`: `value` is the fraction of the affected region's GDP destroyed (e.g. `0.03` = 3%), applied as a `$mul` on `state.gdp` so the economy regrows from the reduced base afterward, the loss persists across turns, unlike a `metric` effect on `economic.gdpGrowth` which only drags the growth rate.

### Stat Effects

Target a specific character stat (`statKey`: `charisma`, `debate`, `energy`, etc.) via `applyStatEffects()`.

## Crisis Catalog and Bloc-Alignment Crisis Chains

There is a second, distinct crisis subsystem for the bloc-alignment game (`src/lib/alignment/crisisCatalog.ts`, `src/lib/alignment/crisisTurn.ts`, `src/lib/alignment/crisis.ts`), Cold War flashpoints that raise a target nation's alignment-movement ceiling while open, rather than mutating `stateMetrics`/`governmentApproval`/`corporateSectors` directly. It stores its documents in a separate `alignmentCrises` collection (`getAlignmentCrisesCollection`), not `crises`.

### Catalog

`AUTHORED_CRISES` (`crisisCatalog.ts`) is a fixed list of historical anchors, each gated to an inclusive era window (`minYear`-`maxYear`) and a preferred `targetEntityId`: Hungarian Rising (HU, 1956-58), Suez Intervention (EG, 1956-58), Berlin Flashpoint (DD, 1958-63), Missile Standoff (CU, 1962-64), Prague Spring (CS, 1968-70). `authoredCrisesForYear(year)` filters the catalog to crises whose window contains the current year.

`EMERGENT_CRISES` defines two world-condition-driven kinds instead of calendar-driven ones: `emergent.defection` (a bloc member visibly trying to leave) and `emergent.tugOfWar` (a country two blocs are both heavily invested in).

### Per-Turn Chain Resolution

Each turn, `openDueCrises()` and `closeDueCrises()` (`src/lib/alignment/crisisTurn.ts`) run the crisis lifecycle:

1. **Close due crises**, any crisis with `status: "open"` and `closesTurn <= currentTurn` resolves.
2. **Open new flashpoints**, up to `MAX_OPEN_CRISES = 3` concurrently, in strict precedence order:
   - **Authored anchors** fire once each per world, gated by era window. If the anchor's preferred target is not movable (already at `ALIGNMENT_GATES.locked`) or already claimed this turn, it **retargets** to the most contested movable nation instead of fizzling (`retargetedFrom` records the original target). Egypt and Cuba are deliberately kept in the catalog though neither is an implemented country, an authored crisis targeting them retargets to a real flashpoint.
   - **Defection crises** open for any bloc member that has wanted out for at least `SUSTAIN_TURNS / 2` turns (`DEFECTION_CRISIS_AT`).
   - **Tug-of-war crises** open for any nation two poles are both contesting (`tugOfWarCandidate()`).
3. Each opened crisis gets a `closesTurn` of `currentTurn + CRISIS_WINDOW_TURNS`.

A crisis itself pays out nothing directly, while open, it raises its target's movement ceiling (`openCrisisTargets()` feeds `CRISIS_TURN_CAP` elsewhere in the alignment turn phase), so ordinary sphere-projection plays against that nation can move further than anywhere else. A crisis nobody acts on changes nothing.

See [bloc-alignment-and-spheres.md](./bloc-alignment-and-spheres.md) for the surrounding bloc-stress/sphere-projection system this feeds into.

## Turn Processing

Handled by `processCrisisTurn()` in `src/lib/turn/crisisTurn.ts`:

| Phase                           | Action                                                                     |
| ------------------------------- | -------------------------------------------------------------------------- |
| **Load active crises**          | Fetch all crises with `status: "active"`                                   |
| **Resolve scope**               | Convert scope + countryIds/regionIds to target state IDs                   |
| **Apply flat effects**          | Only if `turn === crisis.startTurn`                                        |
| **Apply tick effects**          | Every turn while active                                                    |
| **Apply metric effects**        | Bulk `$inc` to `stateMetrics`                                              |
| **Apply approval effects**      | `$inc` to `governmentApproval` by country                                  |
| **Apply profit margin effects** | Update `corporateSectors` with clamping                                    |
| **Wire events**                 | Emit `crisis_start` on activation, `crisis_end` on resolution              |
| **Auto-resolve**                | Mark expired crises as `resolved` when `turn >= startTurn + durationTurns` |

## Wire Event Integration

Crises emit wire events for real-time notifications:

```typescript
// On activation (start turn only)
logWireEvent("crisis_start", crisis.wireMessageOnStart, {
  href: `/world/crises/${crisis._id.toString()}`,
});

// On resolution (auto or manual)
logWireEvent("crisis_end", crisis.wireMessageOnEnd, {
  href: `/world/crises/${crisis._id.toString()}`,
});
```

## Lifecycle

1. **Creation**: Admin creates crisis via admin panel or API
2. **Activation**: Crisis effects apply immediately on next turn processing
3. **Duration**: Tick effects apply each turn; flat effects only on start turn
4. **Resolution**:
   - **Auto**: When `turn >= startTurn + durationTurns` (if `durationTurns` is set)
   - **Manual**: Admin marks as resolved via admin panel
5. **Cleanup**: Resolved crises remain in database for historical reference

## Admin Management

Crises are created and managed via admin routes (not yet documented in public API):

- **Create**: Admin panel → World → Crises → Create
- **Resolve**: Mark active crisis as resolved
- **Edit**: Modify effects, duration, scope

## Database

### `crises` collection

| Field                | Type           | Description                            |
| -------------------- | -------------- | -------------------------------------- |
| `_id`                | ObjectId       | Document ID                            |
| `name`               | string         | Crisis name                            |
| `description`        | string         | Crisis description                     |
| `scope`              | string         | `"global"`, `"country"`, or `"region"` |
| `countryIds`         | string[]       | Affected country IDs                   |
| `regionIds`          | string[]       | Affected state/region IDs              |
| `status`             | string         | `"active"` or `"resolved"`             |
| `startTurn`          | number         | Activation turn                        |
| `endTurn`            | number \| null | Resolution turn                        |
| `durationTurns`      | number \| null | Duration in turns                      |
| `effects`            | array          | Crisis effect definitions              |
| `wireMessageOnStart` | string         | Start wire event message               |
| `wireMessageOnEnd`   | string \| null | End wire event message                 |
| `createdBy`          | ObjectId       | Admin who created                      |
| `createdAt`          | Date           | Creation timestamp                     |
| `resolvedAt`         | Date \| null   | Resolution timestamp                   |

## Example Crises

### Financial Crisis (Country-wide, tick effects)

```typescript
{
  name: "Financial Crisis",
  description: "A severe banking crisis spreads across the nation",
  scope: "country",
  countryIds: ["US"],
  status: "active",
  startTurn: 480,
  durationTurns: 96, // 2 years
  effects: [
    {
      effectType: "tick",
      targetType: "metric",
      metricCategory: "economic",
      metricField: "gdpGrowth",
      value: -0.2,
      label: "Economic contraction"
    },
    {
      effectType: "tick",
      targetType: "metric",
      metricCategory: "economic",
      metricField: "unemploymentRate",
      value: 0.05,
      label: "Job losses"
    },
    {
      effectType: "tick",
      targetType: "approval",
      value: -0.25,
      label: "Government blame"
    }
  ],
  wireMessageOnStart: "A financial crisis has gripped the nation",
  wireMessageOnEnd: "The financial crisis has ended"
}
```

### Regional Drought (Region-specific, flat + tick)

```typescript
{
  name: "California Drought",
  description: "Severe drought conditions impact agriculture",
  scope: "region",
  regionIds: ["CA", "NV", "AZ"],
  status: "active",
  startTurn: 500,
  durationTurns: 48, // 1 year
  effects: [
    {
      effectType: "flat",
      targetType: "metric",
      metricCategory: "infrastructure",
      metricField: "waterSupply",
      value: -20,
      label: "Water shortage"
    },
    {
      effectType: "tick",
      targetType: "profitMargin",
      sectorType: "agriculture",
      value: -3,
      label: "Crop failure costs"
    }
  ]
}
```

## Key Files

| File                              | Purpose                                              |
| --------------------------------- | ---------------------------------------------------- |
| `src/lib/db/types/crisis.ts`      | TypeScript interfaces for Crisis and CrisisEffect    |
| `src/lib/turn/crisisTurn.ts`      | Turn processing: effect application, auto-resolution |
| `src/lib/turn/crisisTurn.test.ts` | Unit tests for crisis turn processing                |
| `src/lib/wireEvent.ts`            | Wire event logging for crisis start/end              |
| `src/lib/alignment/crisisCatalog.ts` | Authored + emergent bloc-alignment crisis catalog  |
| `src/lib/alignment/crisisTurn.ts` | Bloc-alignment crisis open/close lifecycle           |
| `src/lib/alignment/crisis.ts`     | Alignment crisis helpers (`mostContested`, `tugOfWarCandidate`) |

## Related Documentation

- [Policy System](./policy-system.md), State metrics that crises can modify
- [Corporations](./corporations.md), Profit margin effects on corporate sectors
- [National Metrics](./national-metrics.md), Government approval affected by crises
