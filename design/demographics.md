# Demographics

## Overview

The demographic system drives election vote calculations and polling. Each state has demographic data with **12 voter archetypes** — mutually exclusive groups derived from Layer 1 (census-style) characteristics. Candidate appeal is computed by comparing policy positions to group preferences.

## Structure (12 Archetypes)

### Voter Groups (single category)

One category `voterGroups` with 12 mutually exclusive archetypes:

| ID                    | Name                  | Econ | Social | Turnout |
| --------------------- | --------------------- | ---- | ------ | ------- |
| young_renters         | Young Renters         | -4   | -4     | 38%     |
| evangelicals          | Evangelicals          | +4   | +5     | 72%     |
| rural_traditionalists | Rural Traditionalists | +4   | +4     | 68%     |
| union_trades          | Union & Trades        | -3   | +1     | 52%     |
| soccer_moms           | Soccer Moms           | 0    | -1     | 58%     |
| college_liberals      | College Liberals      | -5   | -5     | 68%     |
| small_business        | Small Business        | +4   | +2     | 72%     |
| public_sector         | Public Sector Workers | -3   | -2     | 70%     |
| retirees              | Retirees              | +2   | +3     | 72%     |
| libertarians          | Libertarians          | +5   | +2     | 68%     |
| new_immigrants        | New Americans         | -2   | -1     | 42%     |
| secular_professionals | Secular Professionals | -3   | -4     | 74%     |

> **Note:** State ideology composition modulates leans for retirees, soccer moms, union & trades, and rural traditionalists — their actual values shift slightly based on how conservative or progressive each state is.

Groups have `defaultEconomicLean`, `defaultSocialLean`, and `defaultTurnout`.

### State Demographics

Per state (`StateDemographics`):

- **categoryWeights**: `{ voterGroups: 100 }`
- **groups**: `Record<groupId, StateDemographicGroup>`
  - `population`: 0–100 (percentage of state; all 12 sum to 100)
  - `economicLean`: -5 to +5 (derived from defaults + ideology modulation)
  - `socialLean`: -5 to +5 (derived from defaults + ideology modulation)

### Derivation

Group sizes and leans are derived from Layer 1 (race, education, wealth, age, ideology) via weighted formulas. No manual per-state data entry — all values come from census-style config. See `src/lib/seeds/stateDemographics.ts`.

**Ideology modulation:** For four swing groups, leans shift based on the state's conservative/progressive ideological composition:

- **Retirees** — lean more conservative in high-evangelical/patriot states
- **Soccer Moms** — lean slightly left in high-progressive states
- **Union & Trades** — economic lean shifts with progressive vs. patriot balance
- **Rural Traditionalists** — social lean shifts with overall conservative density

### Vote / Appeal Calculation (Phase 1: Group-Level Competitive Allocation)

Shared formula in `src/lib/utils/demographicAppeal.ts`, used by `electionEngine.ts`, poll route, and NPP dropout:

1. For each category, for each group: get state population share, group lean, turnout
2. **Reach**: `politicalInfluence / 100` — fraction of turned-out voters the candidate reaches
3. **Appeal**: Quadratic position (50 − |econDiff|×5 − |socialDiff|×5)²/100 + (politicalInfluence/100)×25 — max 50
4. **Group-level allocation**: Each group contributes to the turn pool proportionally to its size. Within each group, candidates split that contribution by relative `(appeal × reach × approval × partyOrg)`. Groups vote as blocs.
5. **Approval scalar**: `favorability / 100` — voters won't support candidates they don't approve of
6. **Party org scalar**: 0.5 + (organization/100)×0.5 — higher state party org = better mobilization
7. **Final votes**: Sum over groups of each candidate's share from that group

## Policy Positions

Candidates have `policies.economic` and `policies.social` (-5 to +5). Compared to each group's `economicLean` and `socialLean` for alignment.

## State-Level Distribution

- Each state has different `categoryWeights` and `groups` data
- Admin configurable via Admin → Demographics
- Affects which policies are popular in each state

### Default Category Weights

Default weights (sum to 100): Education 25%, Wealth 20%, Race 15%, Ideology 15%, Age 12.5%, Gender 12.5%.

## State Political Lean

State lean is computed from demographics for display on state pages and the map (`src/lib/utils/demographics.ts`):

1. **Turnout-weighted average**: For each group, multiply population share × turnout to get voter weight. Sum `economicLean × weight` and `socialLean × weight`, divide by total weight.
2. **Display lean**: Average of economic and social lean. Clamped to −5..+5.
3. **Label**: Based on compressed thresholds matching real-world state variance:

| Display lean | Label      |
| ------------ | ---------- |
| ≤ −0.6       | Very Left  |
| −0.6 to −0.2 | Left       |
| −0.2 to +0.2 | Center     |
| +0.2 to +0.6 | Right      |
| ≥ +0.6       | Very Right |

Used for: state page top stats bar, map Political Lean mode (blue/red shading), state panel on map.

> The lean display scale is separate from election mechanics — elections use raw position differences (−5..+5) directly, not the display lean.

## State-Level Demographic Turnout

The turnout system allows strategic manipulation of voter participation through party GOTV spending and player canvassing actions. Each state tracks turnout modifiers for **21 Layer 1 demographics** (race: 5, age: 4, education: 3, wealth: 3, ideology: 6).

### Core Mechanics

**Modifiers**: Each demographic has a modifier from **-20% to +20%** (additive to baseline turnout).

**Decay**: All modifiers decay **2% per turn** toward 0%, requiring sustained investment to maintain boosts.

**Diminishing Returns**: Larger existing modifiers receive smaller boosts:

- Formula: `adjustedBoost = rawBoost × (1 - |currentModifier| / 20)`
- Example: At +10% modifier, a 1% boost becomes 0.5% effective boost

### Party GOTV (Passive)

Each party budget (national or state-level) has `gotvBudgetPerTurn` that is spent automatically each turn:

1. **Eligible Demographics**: Only boosts demographics within 2 points of party position on **both** economic and social axes
2. **Allocation**: Budget divided equally among eligible demographics
3. **Boost**: Each eligible demographic receives `budgetPerDemo × 0.01%` turnout boost (before diminishing returns)
4. **Treasury**: Party treasury is debited by `gotvBudgetPerTurn` each turn

**Example**: DEM party at (-4, -4) with $100 GOTV budget would boost Progressives (-5, -5), Environmentalists (-3, -4), etc., but NOT Evangelicals (+4, +5).

### Player Canvassing (Active)

Campaign action to boost a specific demographic in the candidate's home state:

**Cost**: 100 funds, 1 action point

**Effectiveness Formula**:

```
baseBoost = 0.05%
distance = |charEcon - demoEcon| + |charSocial - demoSocial|
alignmentMultiplier = max(0.1, 1.0 - distance × 0.15)
seasonMultiplier = isActiveCampaignSeason ? 2.0 : 1.0
finalBoost = baseBoost × alignmentMultiplier × seasonMultiplier
```

**Alignment Scaling**:

- Perfect alignment (distance 0): 1.0x multiplier
- Poor alignment (distance 10): 0.1x multiplier (minimum)

**Campaign Season**: Active campaign season = 4 turns before election. During this period, canvassing is **2x more effective**.

**Immediate Effect**: Unlike other actions, canvassing applies its effect immediately (not queued until turn processing).

### Election Integration

State-specific turnout modifiers are applied to election calculations via `deriveGroupTurnout`:

1. **Baseline turnout** for each voter group (e.g., Young Renters: 38%)
2. **Layer 1 contribution**: Each voter group is composed of Layer 1 demographics (race, age, education, wealth, ideology)
3. **Modifier application**: For each Layer 1 demographic in the composition, apply state-specific modifier
4. **Final turnout**: `baseline + sum(layer1Modifiers × layer1Weight)`

**Example**: Young Renters in PA:

- Baseline: 38%
- Composed of: Young (age), Renters (wealth), etc.
- If PA Young modifier is +5%, final turnout ≈ 43%

### Data Structures

**StateDemographicTurnout** (`stateDemographicTurnout` collection):

```typescript
{
  _id: "PA",  // state ID
  modifiers: {
    race: { white: 2.5, black: -1.2, hispanic: 0, asian: 0, other: 0 },
    age: { young: 5.0, mid: 0, mature: -0.5, senior: 1.0 },
    education: { no_college: 0, college: 3.5, graduate: 2.0 },
    wealth: { low: -1.0, middle: 0, high: 0.5 },
    ideology: { evangelicals: 0, environmentalists: 4.0, ... }
  },
  lastDecayApplied: Date,
  lastUpdated: Date
}
```

**PartyBudget** (`partyBudgets` collection):

```typescript
{
  _id: ObjectId,
  partyId: "DEM",
  scope: "state",  // or "national"
  stateId: "PA",   // required if scope === "state"
  treasury: 10000,
  gotvBudgetPerTurn: 100,
  chairCharacterId: ObjectId | null,
  createdAt: Date,
  updatedAt: Date
}
```

### Turn Processing Order

Demographic turnout processing occurs in **sequential order** during turn processing:

1. **Decay**: Apply 2% decay to all existing modifiers
2. **Party GOTV**: Process all active party budgets, apply alignment-based boosts
3. **Player Canvassing**: Process queued canvassing actions (currently immediate, but designed for queue integration)

### UI Components

**Turnout Display** (`/state/[id]` → "Turnout" tab):

- Shows baseline, modifier, and actual turnout for all 21 Layer 1 demographics
- Color-coded: green = boosted, red = decreased
- Grouped by category (race, age, education, wealth, ideology)

**Canvassing Panel** (`/campaign/[id]` → "Canvassing" section):

- Two-step selection: category → specific group
- Shows cost (100 funds, 1 action)
- Displays effectiveness factors (alignment, campaign season)

### Admin Controls

**Party Budget Management** (`/api/admin/party-budget`):

- GET: Fetch budgets with optional partyId/stateId filters
- POST: Update `gotvBudgetPerTurn` or `treasury`
- Admin-only endpoint

### Implementation Files

**Core Logic**:

- `src/lib/turn/demographicTurnoutTurn.ts` — Turn processing (decay, GOTV, canvassing)
- `src/lib/utils/turnoutDecay.ts` — 2% decay formula with threshold rounding
- `src/lib/utils/demographicAlignment.ts` — Party GOTV alignment filtering
- `src/lib/utils/diminishingReturns.ts` — Diminishing returns calculation

**Election Integration**:

- `src/lib/seeds/stateDemographics.ts` — `deriveGroupTurnout` (applies state modifiers), `computeLiveGroupTurnouts` (fetches state modifiers from DB)

**API Routes**:

- `src/app/api/canvassing/route.ts` — Player canvassing endpoint
- `src/app/api/admin/party-budget/route.ts` — Party budget management
- `src/app/api/state/[id]/turnout/route.ts` — View turnout data

**UI Components**:

- `src/app/campaign/[id]/components/CanvassingPanel.tsx` — Canvassing interface
- `src/app/state/[id]/components/TurnoutDisplay.tsx` — Turnout visualization

**Types & Collections**:

- `src/lib/db/types/stateDemographicTurnout.ts` — StateDemographicTurnout type
- `src/lib/db/types/partyBudget.ts` — PartyBudget type (discriminated union)
- `src/lib/db/collections.ts` — Collection getters

**Tests**:

- `tests/integration/demographicTurnout.test.ts` — Integration test suite

## How Demographics Affect Gameplay

### Elections (Primary & General)

- Primary: Score = alignment to party position + favorability bonus + influence bonus
- General: Vote potential from demographic appeal × reach; votes distributed proportionally each turn

### Polling

- Quick Poll: Topline appeal, best/worst 5 groups
- Full Demographic Poll: Breakdown by every category and group

## Related Documentation

- [[Election Mechanics]] — Vote accumulation, primary score
- [[Stats & Actions]] — Poll actions
- [[Technical Architecture]] — Collections: demographicCategories, stateDemographics
