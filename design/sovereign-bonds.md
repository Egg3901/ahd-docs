# Sovereign Bonds

Sovereign bonds are **government-issued** debt instruments that finance national deficits. They reuse the corporate bond trading infrastructure but integrate with the federal budget system.

## Overview

- **Issuers**: National governments (US Treasury, UK HM Treasury)
- **Trading**: Same `/api/bonds/` routes as corporate bonds; appear on country stock exchange pages
- **Settlement**: Maturity payments deducted from federal budget debt principal
- **Countries supported**: US, UK (configured in `COUNTRY_CONFIGS`)

## Issuance Cycle

### Quarterly Automatic Issuance

Sovereign bonds are issued automatically every **12 turns** (quarterly in game time: 48 turns = 1 year):

```typescript
// src/lib/bonds/sovereign.ts:14-15
export const SOVEREIGN_ISSUANCE_INTERVAL_TURNS = 12;
export const SOVEREIGN_BOND_MATURITY_TURNS = 48; // 1 year
```

### Issuance Amount

Each quarter the issued face value is the sum of two components:

```typescript
issueAmount = rolloverAmount + deficitAmount;
```

**Deficit component** — quarter share of the annual budget deficit, rounded to whole $1,000 bond units:

```typescript
const quarterlyAmount = annualDeficit / 4;
const deficitAmount = Math.floor(quarterlyAmount / 1000) * 1000;
```

If the budget is in surplus, `deficitAmount` is zero.

**Rollover component** — total `totalIssued` of active sovereign bonds maturing in the upcoming quarter (`[turn, turn + 12)`), rounded to whole bond units. This refinances maturing debt so the public float stays liquid even when the country is running a surplus.

Without rollover, a surplus country's bonds mature out of circulation and the trading market eventually empties. With it, the bond float is replenished each quarter at the current prime rate, matching real-world Treasury rollover behavior.

### Coupon Rate

Sovereign bonds use the **central bank prime rate** as the coupon rate (no credit spread):

```typescript
const primeRate = centralBank.primeRate ?? 5.5; // e.g., 5.5%
const couponRate = primeRate; // Sovereign debt has no credit risk premium
```

### Bond Structure

| Field           | Value                                             |
| --------------- | ------------------------------------------------- |
| `issuerType`    | `"sovereign"`                                     |
| `countryId`     | `"US"` or `"UK"`                                  |
| `faceValue`     | $1,000 per unit (`BOND_UNIT_FACE_VALUE`)          |
| `maturityTurns` | 48 turns (1 year)                                 |
| `marketPrice`   | Starts at 1.0 (par)                               |
| `publicFloat`   | All units start in public float (AI market maker) |
| `holders`       | Players/corporations who purchase                 |

## Budget Integration

### Issuance Accounting

When bonds are issued, the federal budget is updated:

```typescript
// src/lib/bonds/sovereign.ts:74-102 applySovereignDebtAdjustment()
newPrincipal = oldPrincipal + bond.totalIssued;
newDebtInterest = oldDebtInterest + (couponRate / 100) * totalIssued;
newSurplus = revenue - (spending + newDebtInterest);
debtToGdpRatio = newPrincipal / GDP;
creditRating = calculateCreditRating(debtToGdpRatio);
interestRate = calculateInterestRate(debtToGdpRatio);
```

### Per-Turn Processing

In `processBondTurn()` (`src/lib/turn/bondTurn.ts`):

1. **Coupon payments** — Paid to bond holders (character cash / corporate capital)
2. **Market price update** — Based on country prime rate and time to maturity
3. **Maturity settlement** — Face value returned to holders; principal deducted from budget
4. **History snapshot** — `bondHistory` collection tracks price and cumulative interest

### Maturity Settlement

When sovereign bonds mature:

```typescript
// src/lib/bonds/sovereign.ts:264-289 settleSovereignBondMaturity()
const annualCouponCost = (couponRate / 100) * totalIssued;
budget.debt.principal -= totalIssued;
budget.spending.debtInterest -= annualCouponCost;
budget.surplus += annualCouponCost; // Lower interest = higher surplus
```

## Turn Processing Pipeline

`processBondTurn()` in `src/lib/turn/bondTurn.ts` handles sovereign bonds:

| Phase                | Action                                                                  |
| -------------------- | ----------------------------------------------------------------------- |
| **Pre-processing**   | `issueScheduledSovereignBondSeries()` — issues new bonds every 12 turns |
| **Coupon payment**   | Pay holders (characters + corporations) from issuer budget              |
| **Price update**     | `calculateBondMarketPrice()` using country prime rate                   |
| **Maturity check**   | Settle matured bonds via `settleSovereignBondMaturity()`                |
| **History snapshot** | Insert `bondHistory` document with market price and cumulative interest |

Sovereign bonds **cannot default** — they skip the corporate default check (`liquidCapital < 0`).

## Trading

### Player Purchases

Players can buy sovereign bond units from the public float:

- **Route**: `POST /api/bonds/:id/buy`
- **Payment**: Deducted from character `cashOnHand`
- **Income**: Coupon payments added to `cashOnHand` each turn
- **Maturity**: Face value ($1,000/unit) returned to `cashOnHand`

### Corporate Purchases

Corporations can buy sovereign bonds as investments:

- **Route**: `POST /api/bonds/:id/buy?corporationId=...`
- **Payment**: Deducted from corporate `liquidCapital`
- **Income**: Coupon payments added to `liquidCapital`

### Market Price Dynamics

Sovereign bond prices fluctuate based on:

```typescript
// src/lib/constants/bonds.ts calculateBondMarketPrice()
const price = (couponPayment / ((currentRate / 100) * faceValue)) * faceValue;
// Where currentRate = country central bank prime rate
```

When prime rates rise, existing bond prices fall (and vice versa).

**Pull-to-Par Convergence:**
As a bond approaches its maturity turn, the market price naturally converges toward 1.0 (par). The current prime rate impact is dampened by a time-to-maturity scalar, ensuring that the bond does not experience a price shock at the moment of settlement.

**Payment Guarantee:**
Sovereign bonds cannot default. Coupon payments are guaranteed by the state. If the federal budget is insufficient to cover these payments, the deficit is increased automatically, effectively "printing" the necessary currency to meet the obligation. This reflects the sovereign's unique ability to monetize debt.

## Admin Testing

### Test Issuance

Admins can manually issue sovereign bonds for testing:

```bash
POST /api/admin/sovereign-debt/
{
  "countryId": "US" | "UK",
  "faceValue": number, // optional; defaults to quarterly deficit amount
  "maturityTurns": 48 | 96 | 240
}
```

### Collections

| Collection      | Purpose                                       |
| --------------- | --------------------------------------------- |
| `bonds`         | Bond documents with `issuerType: "sovereign"` |
| `bondHistory`   | Per-turn price and interest snapshots         |
| `federalBudget` | US federal debt principal and interest        |
| `centralBanks`  | Prime rate for pricing                        |

## Key Files

| File                         | Purpose                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `src/lib/bonds/sovereign.ts` | Sovereign bond issuance, settlement, budget integration |
| `src/lib/turn/bondTurn.ts`   | Per-turn coupon payments, price updates, maturity       |
| `src/lib/budget/debt.ts`     | Credit rating and interest rate calculations            |
| `src/app/api/bonds/`         | Bond trading API routes                                 |
| `src/app/bond/[id]/page.tsx` | Bond detail page with buy panel                         |

## Related Documentation

- [[Corporations]] — Corporate bonds (credit rating, trading, defaults)
- [[National Budget & Treasury]] — Federal budget, debt, deficit mechanics
- [[Stock Market]] — NYSE/FTSE listings where sovereign bonds appear
