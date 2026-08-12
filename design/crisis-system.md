# Crisis System

Crises are dynamic events that modify state metrics, government approval, and corporate profit margins across affected regions. They can be one-time shocks (flat effects) or ongoing situations (tick effects).

## Overview

- **Purpose**: Create dynamic economic/political events that challenge players and alter the game world
- **Scope**: Global, country-wide, or region-specific
- **Duration**: Fixed (N turns) or indefinite (manual resolution)
- **Effects**: State metrics, government approval, corporate profit margins
- **Turn Processing**: Runs in Group 11 (Effects & Metrics) — parallel-safe

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

| Field            | Type                                           | Description                                                                               |
| ---------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `effectType`     | `"flat"` \| `"tick"`                           | **flat**: applied once on start turn only; **tick**: applied every turn while active      |
| `targetType`     | `"metric"` \| `"approval"` \| `"profitMargin"` | What the effect modifies                                                                  |
| `metricCategory` | string \| null                                 | Category name (e.g., `"economic"`) — for metric effects                                   |
| `metricField`    | string \| null                                 | Field name (e.g., `"unemploymentRate"`) — for metric effects                              |
| `sectorType`     | string \| null                                 | Corporation sector type filter — for profit margin effects; null = all sectors            |
| `strategyId`     | string \| null                                 | Operating strategy filter — for profit margin effects; null = all strategies              |
| `value`          | number                                         | Effect magnitude. Negative = penalty; positive = bonus. Profit margin = percentage points |
| `label`          | string                                         | Display name for the effect (e.g., "Unemployment spike")                                  |

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

## Related Documentation

- [[Policy System]] — State metrics that crises can modify
- [[Corporations]] — Profit margin effects on corporate sectors
- [[National Metrics]] — Government approval affected by crises
