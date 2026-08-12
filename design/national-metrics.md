# National Metrics System

## Overview

The national metrics system tracks 47 socioeconomic indicators across 10 categories for every state/region in the game. Each state has a `stateMetrics` document; population-weighted national averages are derived from those documents each turn and stored as special national-scope documents (`"federal"` for the US, `"uk_national"` for the UK).

National metrics serve two purposes: they power the national metrics page (rankings, distribution, approval ratings) and they feed into the government approval calculation. Government approval, in turn, influences vote accumulation during elections. For the approval formula and named modifier conditions, see [[Government Approval]].

## Metric Categories

There are 10 categories, each with 4–6 constituent metrics.

### Economic (6 metrics)

`unemploymentRate`, `medianIncome`, `gdpGrowth`, `povertyRate`, `costOfLiving`, `smallBusinessFormation`

### Education (6 metrics)

`highSchoolGradRate`, `collegeEnrollment`, `testPerformance`, `educationSpending`, `literacyRate`, `workforceSkill`

### Healthcare (6 metrics)

`uninsuredRate`, `affordabilityIndex`, `physicianRate`, `lifeExpectancy`, `preventableMortality`, `publicHealthPreparedness`

### Infrastructure (6 metrics)

`roadCondition`, `broadbandAccess`, `publicTransit`, `waterQuality`, `powerGridReliability`, `infrastructureInvestmentGap`

### Public Safety (6 metrics)

`crimeRate`, `violentCrimeRate`, `policePerCapita`, `incarcerationRate`, `recidivismRate`, `publicSafetyConfidence`

### Environment (6 metrics)

`airQuality`, `renewableEnergy`, `carbonEmissions`, `recyclingRate`, `climateResilience`, `protectedLand`

### Social (6 metrics)

`socialMobility`, `incomeInequality`, `homelessnessRate`, `foodInsecurity`, `civicParticipation`, `socialCohesion`

### Governance (5 metrics)

`governmentTransparency`, `budgetBalance`, `corruptionIndex`, `voterTurnout`, `publicTrust`

### Population (4 metrics)

`populationGrowth`, `urbanizationRate`, `medianAge`, `migrationRate`

### Media & Information (5 metrics)

`mediaPolarization`, `disinformationRisk`, `pressFreedom`, `socialMediaSentiment`, `newsTrust`

Each metric value is stored as a `StateMetricValue` object: `{ value: number; trend?: number }`.

## State vs National vs Global

**State metrics** are the ground truth. Each state has one `stateMetrics` document keyed by its state ID (e.g., `"TX"`, `"CA"`). Policy effects and demographic effects write to these documents directly; the national aggregates are never written to by those systems.

**National aggregates** are population-weighted averages of state metrics. `computeNationalMetrics()` runs each turn after policy and demographic effects, iterating over all states for a given country and computing a weighted average for every metric key. The result is upserted into `stateMetrics` under the national-scope ID (`"federal"` or `"uk_national"`). These documents are excluded from all aggregation computations to avoid circular double-counting — `NATIONAL_SCOPE_IDS` is used as a filter wherever state-only data is needed.

**Global averages** are computed on-the-fly by `GET /api/national/metrics` when calculating national government approval. All state-only `stateMetrics` documents across all countries are averaged (again excluding national-scope docs), giving a cross-country baseline. The country's national averages are then compared against this global baseline using the same relative formula applied to states vs their national average. This prevents national approval from being structurally anchored near 50%, which would happen if state-relative scores were averaged directly.

## API Endpoints

### `GET /api/national/metrics`

The comprehensive metrics endpoint. Query parameters:

- `country` — `"US"` (default) or `"UK"`
- `category` — optional filter to a single `MetricCategoryId`

**What it does:**

1. Fetches all states for the requested country, then their `stateMetrics` documents.
2. For each metric, computes: simple average, population-weighted average, min state, and max state.
3. Builds a ranked list of all states for each metric (direction-aware: lower-is-better metrics rank ascending, higher-is-better rank descending).
4. Computes per-state government approval (state metrics vs national averages) and active named modifiers.
5. Computes national government approval by fetching all state-only metrics globally (excluding national-scope docs) to form the global baseline, then comparing the country's population-weighted averages against it.

**Response shape:**

```ts
{
  categories: { [categoryId]: { [metricId]: { average, populationWeightedAverage, min, max } } };
  stateRankings: { [categoryId]: { [metricId]: { stateId, stateName, value, rank }[] } };
  totalPopulation: number;
  calculatedAt: string; // ISO timestamp
  governmentApproval: number;
  governmentApprovalBase: number;
  governmentApprovalModifiers: ActiveModifier[];
  stateApprovals: { stateId, stateName, approval, baseApproval, modifiers }[];
}
```

All values are computed on-the-fly from the current `stateMetrics` documents; nothing is read from the national-scope aggregate docs for this response (the aggregates computed during turn processing are used for history charting, not for this endpoint's per-metric breakdowns).

### `GET /api/national/approval`

A lightweight endpoint optimised for the approval chart widget. Query parameters:

- `country` — `"US"` (default) or `"UK"`

**What it does:**

1. Fetches state IDs and populations for the country.
2. Computes `computeNationalAveragesFromMetrics()` over those state metrics.
3. Calls `calculateStateApproval()` for each state (state vs national average), then `calculateNationalApproval()` — a population-weighted average of state approval scores.
4. Reads the `governmentApprovals` collection for the persisted turn-by-turn `history` array.

**Response shape:**

```ts
{
  governmentApproval: number;
  history: Array<{ turn: number; approval: number; net: number }>;
}
```

The response is cached at the CDN layer (`Cache-Control: public, max-age=300, stale-while-revalidate=60`).

Note: this endpoint calculates approval differently from `/api/national/metrics`. Here, national approval is the population-weighted average of state approvals (each state vs its own national average). The `/api/national/metrics` endpoint uses the country-vs-global-average approach instead. The `/api/national/approval` history reflects whichever method `snapshotApprovalHistory` uses at turn time — see [[Government Approval]] for the approval formula details.

## Turn Processing

Metrics are recomputed and snapshotted during the tail of each turn, after all policy and demographic effects are applied:

| Phase name           | Function                                        | When                                                               |
| -------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| `policyEffects`      | `processStatePolicyEffects`                     | Phase 14 — writes state metric values                              |
| `demographicEffects` | `processAllStateDemographics`                   | Phase 14 — adjusts state metrics from demographics                 |
| `nationalMetrics`    | `computeNationalMetrics`                        | Phase 14b — derives national aggregates from updated state metrics |
| `metricHistory`      | `snapshotMetricHistory`                         | Phase 14a — appends current values to history arrays               |
| `approvalSnapshot`   | `snapshotApprovalHistory` (US + UK in parallel) | Phase 15a — persists approval rating to `governmentApprovals`      |

The metric history cap is 96 entries (2 in-game years). History for national-scope IDs (`"federal"`, `"uk_national"`) is also written to `stateMetricHistory` by `snapshotMetricHistory`, so the national metrics detail page can render turn-by-turn charts using the same code path as state pages.

## Database

### `stateMetrics` collection

One document per state (keyed by state ID string, e.g., `"TX"`) plus one per country national scope (`"federal"`, `"uk_national"`).

Key fields:

- `_id: string` — state ID or national-scope ID
- `economic`, `education`, `healthcare`, `infrastructure`, `publicSafety`, `environment`, `social`, `governance`, `population`, `mediaInformation` — category objects, each containing `{ value: number; trend?: number }` per metric
- `lastUpdated: Date`

National-scope documents have the same shape as state documents but contain population-weighted averages. They are filtered out of all aggregation queries using `NATIONAL_SCOPE_IDS`.

### `governmentApprovals` collection

One document per country, keyed by `CountryId` (e.g., `"US"`, `"UK"`). Snapshotted each turn.

Key fields from `GovernmentApproval`:

- `_id: CountryId`
- `countryId: CountryId`
- `approvalRating: number` — 0–100
- `disapprovalRating: number` — 0–100
- `netApproval: number` — `approvalRating − disapprovalRating`
- `source: "president_favorability" | "pm_favorability" | "aggregate"` — matches `CountryConfig.approvalSource`
- `history: Array<{ turn, approval, net }>` — capped at 20 entries (most recent last)
- `updatedAt: Date`

### `stateMetricHistory` collection

One document per state plus one per national-scope ID. Each document stores per-metric time-series arrays capped at 96 entries:

```ts
{
  _id: string; // state ID or national-scope ID
  economic: { unemploymentRate: [{ turn: number; value: number }, ...]; ... };
  // ... all other categories
}
```

Read by `getMetricHistory(db, stateId, category, metricId)` for chart rendering.

## Election Impact

Government approval feeds into the vote accumulation phase of general elections. See [[Government Approval]] for how approval is calculated and used. In brief: each turn, the vote pool for a race is scaled by `(1 + stateApproval/100) × officeStrength`, where `officeStrength` varies by office type (Governor 1.0, House 0.9, Senate 0.8, State Senate 0.85). Higher state approval means more votes allocated per turn; missing metrics default to 50% approval.

## Key Implementation Files

- `src/lib/db/types/stateMetrics.ts` — `StateMetrics` type, `MetricCategoryId` union
- `src/lib/db/types/governmentApproval.ts` — `GovernmentApproval` type
- `src/lib/nationalMetrics.ts` — `computeNationalMetrics()` (turn phase)
- `src/lib/metricHistory.ts` — `snapshotMetricHistory()`, `getMetricHistory()`
- `src/lib/constants/nationalScope.ts` — `NATIONAL_SCOPE` map, `NATIONAL_SCOPE_IDS` set
- `src/app/api/national/metrics/route.ts` — comprehensive metrics + approval endpoint
- `src/app/api/national/approval/route.ts` — lightweight approval + history endpoint
- `src/lib/utils/governmentApproval.ts` — approval calculation utilities
- `src/lib/utils/approvalModifiers.ts` — named modifier conditions

## Related pages

- [[Government Approval]] — Formulas and modifiers
- [[National Budget & Treasury]] — Treasury panels and fiscal display
- [[Bills & Legislation]] — How laws move metrics
- [[Election Mechanics]] — Vote pool scaling by approval
