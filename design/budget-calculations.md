# Budget Calculations

## Scope and source of truth

This page describes the current fiscal calculation pipeline. `src/lib/budget/`, `src/lib/turn/fiscalBaseGrowth.ts`, and `src/lib/turn/treasuryTurn.ts` are authoritative when a formula changes. The database type still uses the historical names `FederalBudget` and `federalBudget`, but the same national pipeline processes every country budget.

Player-facing fiscal behavior is covered in [National Budget](./national-budget.md). Sovereign debt and crisis resolution are covered in [Sovereign Bonds](./sovereign-bonds.md) and [IMF Sovereign Facility](./imf-sovereign-facility.md).

## Two cadences

Fiscal accounting is split between per-turn accrual and the shared fiscal-year rollover.

### Every turn

`processFiscalBaseGrowth()` reads the latest national and regional metric rates, then applies one forty-eighth of each annual display rate to the relevant tax bases. National bases use national `gdpGrowth`, `wageGrowth`, and `tradeGrowth`; regional bases use their own regional rates. Inflation comes from the owning country's budget state.

After growing the national bases, the phase recomputes national revenue. Regional revenue is reconciled at fiscal-year rollover.

`processTreasuryTurn()` then moves one forty-eighth of the current primary balance into `treasuryBalance`:

```text
primaryPerTurn = (annualRevenue - (annualSpending - annualDebtInterest)) / 48
debtServicePerTurn = openingDebtPrincipal * liveInterestRate / 48
nextTreasuryBalance = currentTreasuryBalance + primaryPerTurn - debtServicePerTurn
```

A positive treasury balance is cash. A negative balance implies debt principal. The turn phase derives principal, interest rate, debt-to-GDP, and credit rating from that signed balance, so the annual rollover does not add the deficit a second time. Enacted tax-rate changes also phase toward their targets here.

### Fiscal-year rollover

The current engine uses one shared rollover boundary: turn 40 of each 48-turn year. `processFiscalYear(db, newFiscalYear, currentTurn)` walks every valid national budget independently.

For each country it:

1. reads national and regional metrics;
2. recalculates inflation and refreshes stored economic factors;
3. derives national GDP from the sum of regional GDP when regional levels exist, with an annual-compounding fallback for unreconciled data;
4. smooths GDP for debt-to-GDP risk calculations;
5. recalculates national revenue and spending;
6. processes debt interest and rating state without duplicating the per-turn primary deficit;
7. applies any active sovereign-IMF austerity cap;
8. reconciles regional budgets using each region's GDP growth;
9. applies debt penalties and saves a fiscal-year snapshot;
10. evaluates the country's sovereign auction outcome.

One malformed budget is skipped and logged without aborting other countries.

## Revenue

`calculateFederalRevenue()` is the national revenue calculator despite its legacy name. It combines normalized tax rates, current tax bases, enacted-law revenue, tariffs, corporate and resource revenue, and country-specific sources. Money remains in the owning country's currency. Cross-country inputs are converted before they enter the budget.

`calculateStateRevenue()` performs the corresponding regional calculation. US states also receive the result of the formula-grant system. Other countries route central-to-regional transfers through enacted laws marked as grants, rather than through the US formula-grant pool.

## Spending

`calculateFederalSpending()` builds national spending from enacted laws, baseline categories, debt interest, and grants. `calculateStateSpending()` does the same for regional budgets. Historical absolute policy costs are era-scaled before totals are computed; GDP fractions and budget-percentage costs already scale with the live economy.

During an active sovereign IMF program, `applyAusterityCap()` proportionally reduces national spending categories, grants, and debt interest when total spending would exceed revenue.

## Debt and sovereign risk

`processAnnualDebt()` reconciles the annual debt view from the already-accrued fiscal position. Ratings use debt-to-GDP bands adjusted by the budget's authored sovereign-risk anchor. Investor confidence can add a borrowing premium. An active sovereign IMF facility caps the live debt rate at the program rate when that is cheaper.

Debt pressure can reduce GDP growth and public trust. The statutory debt-ceiling crisis is US-only. Sovereign auction evaluation runs for every processed country and feeds the separate failed-auction/default pipeline.

## Core collections

| Collection               | Role                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `federalBudget`          | One national budget per country, including tax bases, annual flows, treasury balance, debt, GDP, and ratings |
| `stateBudgets`           | Regional tax bases, revenue, spending, grants, and fiscal state                                              |
| `macroMetrics`           | National and regional growth and inflation inputs used by the fiscal phases                                  |
| `federalBudgetSnapshots` | Fiscal-year history                                                                                          |
| `sovereignBonds`         | Market debt instruments and scheduled issuance                                                               |

## Key implementation files

- `src/lib/turn/fiscalBaseGrowth.ts`, per-turn tax-base growth and national revenue refresh
- `src/lib/turn/treasuryTurn.ts`, per-turn primary balance, debt service, and derived fiscal state
- `src/lib/budget/fiscalYear.ts`, shared annual reconciliation
- `src/lib/budget/revenue.ts`, national and regional revenue
- `src/lib/budget/spending.ts`, national and regional spending
- `src/lib/budget/debt.ts`, rating, interest, and debt-ceiling logic
- `src/lib/budget/grants.ts`, US formula grants
- `src/lib/budget/inflation.ts`, country inflation calculation
- `src/lib/budget/treasuryBalance.ts`, signed-balance derivation helpers

## Related pages

- [Economic Systems](./economic-systems.md)
- [National Metrics](./national-metrics.md)
- [Bills and Legislation](./bills-legislation.md)
- [Turn Processing](./turn-processing.md)
