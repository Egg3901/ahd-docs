# Budget Calculations

## Overview

The Budget Module handles federal and state budget calculations including revenue, spending, debt, and grants. The system processes annual fiscal year transitions with dynamic economic growth.

**Location:** `src/lib/budget/`

**Key files:**

- `fiscalYear.ts` - Fiscal year processing orchestration
- `inflation.ts` - Dynamic inflation calculation
- `revenue.ts` - Federal and state revenue calculations
- `spending.ts` - Federal and state spending calculations
- `debt.ts` - Debt processing and ceiling management
- `grants.ts` - Formula grants to states
- `validation.ts` - Budget validation

## Fiscal Year Processing

### `processFiscalYear(db, newFiscalYear)`

**Purpose:** Process annual fiscal year transition (October = turn 40).

**Fiscal Year Definition:**

- Federal fiscal year starts in October (turn 40)
- FY2021 runs from October 2020 to September 2021
- `calculateFiscalYear(currentYear, currentTurn)` determines FY

**Processing Steps:**

```typescript
1. Get current federal budget
2. Apply economic growth to tax bases
   - GDP growth from stateMetrics pipeline (realized output)
   - Recalculate inflation from current conditions
3. Calculate federal revenue (using grown bases)
4. Process formula grants distribution
5. Update state grant revenue
6. Process debt (interest, deficit, credit rating)
7. Calculate federal spending
8. Update federal budget document
9. Trigger debt ceiling crisis if exceeded
10. Process state budgets (per-state GDP growth)
11. Apply debt penalties (GDP, public trust)
```

### Economic Growth Application

Tax bases grow annually based on economic factors:

```typescript
const economicFactors = {
  gdpGrowth: pipelineGdpGrowth, // From stateMetrics, not static
  wageGrowth: 3.0,
  inflationRate: newInflation, // Dynamically calculated
  tradeGrowth: 2.0,
};

newTaxBases = applyGrowthToFederalBases(federalBudget.taxBases, economicFactors);
newGdp = newGdp * (1 + economicFactors.gdpGrowth / 100);
```

**Key Change:** GDP growth now comes from the `stateMetrics` pipeline (realized economic output) rather than static defaults. This makes tax base growth responsive to actual sector performance.

### Inflation Recalculation

Inflation is recalculated each fiscal year from current economic conditions:

```typescript
const newInflation = await calculateCountryInflation(db, "US", federalBudget);
economicFactors.inflationRate = newInflation;
```

This replaces the static 2.5% default with dynamic inflation driven by:

- Unemployment rate
- GDP growth
- Central bank prime rate
- Fiscal deficit/surplus
- Tariff rates
- Wage growth

See `docs/design/economic-systems.md` for the inflation formula.

## Federal Revenue

### `calculateFederalRevenue(db, taxRates)`

**Purpose:** Calculate federal revenue from all sources.

**Revenue Sources:**

- Individual income taxes
- Corporate income taxes
- Payroll taxes (Social Security, Medicare)
- Excise taxes
- Tariffs
- Other receipts

**Formula:**

```typescript
revenue = taxBase × taxRate × modifiers
```

**Modifiers:**

- Economic conditions (unemployment affects income taxes)
- Policy effects (enacted laws modify rates/bases)

## Federal Spending

### `calculateFederalSpending(db, budget, revenue, debtInterest)`

**Purpose:** Calculate federal spending including mandatory and discretionary programs.

**Spending Categories:**

- Mandatory spending (Social Security, Medicare, etc.)
- Discretionary spending (defense, education, etc.)
- Interest on debt
- State grants

**Formula:**

```typescript
totalSpending = mandatory + discretionary + debtInterest + stateGrants;
```

For historical presets before 2000, absolute local-currency policy costs are
scaled before spending totals are computed. This applies to per-capita and fixed
legacy cost fields, not to GDP multipliers or budget-percentage costs.

## State Revenue

### `calculateStateRevenue(db, stateId, taxRates, federalGrants)`

**Purpose:** Calculate state revenue including federal grants.

**Revenue Sources:**

- State income taxes
- Sales taxes
- Property taxes
- Federal grants
- Other receipts

**Federal Grants:**

```typescript
revenue.total = stateRevenue + federalGrants;
```

## State Spending

### `calculateStateSpending(db, stateId, budget)`

**Purpose:** Calculate state spending based on enacted laws.

**Spending Categories:**

- Education
- Healthcare (Medicaid)
- Infrastructure
- Public safety
- Debt service

## Debt Processing

### `processAnnualDebt(db, budget, nationalGDP)`

**Purpose:** Process annual debt updates.

**Calculations:**

```typescript
interestPayment = debtPrincipal × interestRate
newPrincipal = oldPrincipal + deficit - surplus
debtToGdpRatio = newPrincipal / nationalGDP
```

**Credit Rating:**
Based on debt-to-GDP ratio:

- < 60%: AAA
- 60-80%: AA
- 80-100%: A
- 100-120%: BBB
- 120-150%: BB
- 150-250%: B
- > 250%: CCC (extreme distress; refs #3236, no live-prod country is near this band)

### `triggerDebtCeilingCrisis(db, fiscalYear)`

**Purpose:** Trigger crisis when debt exceeds ceiling.

**Effects:**

- Government shutdown mechanics
- Spending restrictions
- Political consequences

## Formula Grants

### `processFormulaGrants(db, federalRevenueTotal)`

**Purpose:** Distribute formula grants to states.

**Formula:**

```typescript
grantPerState = federalRevenue × allocationPercentage × stateMultiplier
```

**State Multipliers:**

- Population
- Poverty rate
- Infrastructure needs

### `updateStateGrantRevenue(db, stateId, grantAmount)`

**Purpose:** Update state's grant revenue record.

## Per-State GDP Growth

State fiscal year processing uses per-state GDP growth:

```typescript
const stateGdpGrowthMap = new Map(
  allStateMetrics
    .filter((m) => typeof m.economic?.gdpGrowth?.value === "number")
    .map((m) => [String(m._id), m.economic.gdpGrowth.value])
);

for (const state of states) {
  const stateGdpGrowth = stateGdpGrowthMap.get(stateId) ?? nationalAverage;
  const stateFactors = { ...economicFactors, gdpGrowth: stateGdpGrowth };
  await processStateFiscalYear(db, stateId, fiscalYear, grantAmount, stateFactors);
}
```

**Rationale:** States have different economic conditions; per-state GDP growth makes budget calculations more accurate.

## Debt Penalties

### `applyDebtPenalties(db, gdpPenalty, trustPenalty)`

**Purpose:** Apply economic penalties for high debt levels.

**GDP Penalty:**

- Applied indirectly via sector margin modifier
- `debtToGdpMod` affects sector profitability
- Lower profitability → lower revenue growth → lower GDP growth
- **Not** directly mutated to avoid double-counting

**Public Trust Penalty:**

- Directly reduces `governance.publicTrust.value`
- Applied to all states uniformly

```typescript
if (trustPenalty > 0) {
  await db
    .collection("stateMetrics")
    .updateMany({}, { $inc: { "governance.publicTrust.value": -trustPenalty } });
}
```

## Validation

### Budget Validation Functions

The `validation.ts` module provides:

- `validateBudget(budget)` - Check budget structure
- `validateTaxRates(rates)` - Validate tax rate ranges
- `validateSpending(spending)` - Validate spending categories

## Integration Points

### Turn Processing

Fiscal year processing runs in **Group 10** (turn 40 of 48):

```typescript
// src/lib/turnSystem.ts
if (turn === 40) {
  // October
  await processFiscalYear(db, newFiscalYear);
}
```

### Economic Systems

Budget calculations integrate with:

- Inflation calculation (`inflation.ts`)
- GDP growth (from `stateMetrics`)
- Central bank policy (prime rate affects inflation)

### Policy Effects

Enacted laws modify budget calculations:

- Tax rate changes
- Spending program modifications
- Grant formula adjustments

## Data Model

### Collections

| Collection      | Purpose                               |
| --------------- | ------------------------------------- |
| `federalBudget` | Federal budget document               |
| `stateBudgets`  | Per-state budget documents            |
| `stateMetrics`  | Economic metrics including GDP growth |
| `federalDebt`   | Federal debt tracking                 |
| `enactedLaws`   | Laws affecting budget                 |

### Federal Budget Document

```typescript
interface FederalBudget {
  _id: "federal";
  fiscalYear: number;
  taxRates: TaxRates;
  taxBases: TaxBases;
  revenue: RevenueBreakdown;
  spending: SpendingBreakdown;
  surplus: number; // Positive = surplus, negative = deficit
  gdp: number;
  debt: {
    principal: number;
    interestRate: number;
  };
  debtToGdpRatio: number;
  creditRating: string;
  economicFactors: EconomicGrowthFactors;
  updatedAt: Date;
}
```

### Economic Growth Factors

```typescript
interface EconomicGrowthFactors {
  gdpGrowth: number; // From stateMetrics pipeline
  wageGrowth: number;
  inflationRate: number; // Dynamically calculated
  tradeGrowth: number;
  lastUpdated: Date;
}
```

## Tuning Constants

| Constant                         | Value | Purpose                 |
| -------------------------------- | ----- | ----------------------- |
| `FISCAL_YEAR_START_TURN_IN_YEAR` | 40    | October (turn 40 of 48) |
| `TURNS_PER_YEAR`                 | 48    | 48 turns = 1 game year  |

## Related Systems

- **Economic Systems:** `docs/design/economic-systems.md` - Inflation, GDP, unemployment
- **Turn Processing:** `src/lib/turnSystem.ts` - Fiscal year phase
- **Policy Effects:** `src/lib/turn/policyEffects.ts` - Law effects on budget
- **National Metrics:** `docs/design/national-metrics.md` - Economic indicators
