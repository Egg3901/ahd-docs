# Corporate Bond Defaults

Corporate bond defaults occur when a corporation cannot meet its debt obligations. The system handles default detection, credit penalties, distressed debt trading, and dissolution settlements.

**Entry point:** `src/lib/turn/bondTurn.ts` (default detection), `src/lib/bonds/corporateBondDefault.ts` (helpers)

## Overview

- **Trigger:** Corporation `liquidCapital < 0` after coupon payments, AND a solvency gate confirms assets (valued on the same basis the restructure planner uses) cannot cover the debt. A corp that can cover its shortfall from a positive bond buyback escrow, or whose assets exceed its debt, does not default merely for being cash-negative that turn.
- **Penalty:** 96 turns credit rating floor at CCC
- **Trading:** Defaulted bonds trade at 10% recovery value
- **CEO options:** Retire debt at face value, refinance defaulted principal
- **Dissolution:** Bond holders paid first from remaining assets

## Default Detection

Defaults are checked each turn during bond processing:

```typescript
// src/lib/turn/bondTurn.ts:511-596 (Phase 3 / 3.5 / 3.6)

// Phase 3: candidates are corps with liquidCapital < 0 after coupon payments.
// A positive bond buyback escrow can cover the shortfall first
// (coverBondShortfallsFromEscrow); survivors then pass a solvency gate
// (filterInsolventCorps) that checks whether the corp's assets, valued on the
// same exit basis the restructure planner uses, could cover its debt. Only
// corps that fail BOTH checks are added to defaultedCorps.
const stillNegative = await coverBondShortfallsFromEscrow(db, negativeNonNatcorp, now);
const solvencyChecked = await filterInsolventCorps(db, stillNegative, { ... });
for (const idStr of solvencyChecked) defaultedCorps.add(idStr);

// Phase 3.5: cascade, rolling back a defaulted issuer's maturity flows can
// push its own bondholders negative, adding them to defaultedCorps too.
await rollbackDefaultedIssuerMaturityFlows({ db, bondMaturityFlows, defaultedCorps, ... });

// Phase 3.6: apply credit penalty once, after cascade resolution, to every
// corp in defaultedCorps (initial + cascaded).
for (const corpIdStr of defaultedCorps) {
  const nextUntil = turn + BOND_DEFAULT_CREDIT_PENALTY_TURNS; // 96 turns
  const prevUntil = c.bondDefaultCreditPenaltyUntilTurn ?? 0;
  const newUntil = Math.max(prevUntil, nextUntil);
  // ...bulkWrite bondDefaultCreditPenaltyUntilTurn: newUntil
}
```

### Bond Marking

Bonds are marked as defaulted in the same turn:

```typescript
// src/lib/turn/bondTurn.ts:608-628

const isDefaulted = isCorporateBond(bond) ? defaultedCorps.has(corpIdStr) || bond.defaulted : false;

if (isDefaulted && !bond.defaulted) {
  await db.collection("bonds").updateOne(
    { _id: bond._id },
    {
      $set: {
        defaulted: true,
        defaultedAtTurn: turn,
        marketPrice: 0.1,
        updatedAt: now,
      },
    }
  );
}
```

Note: unlike a matured bond (which clears `holders`/`publicFloat` on redemption), a defaulted bond keeps its existing `holders` array; holders are not automatically moved to the public float.

## Credit Penalty

After default, the corporation's credit rating is floored for 96 turns:

```typescript
// src/lib/constants/bonds.ts:237-240

if (options?.bondDefaultCreditPenaltyActive) {
  rating = "CCC";
  compositeScore = Math.min(compositeScore, 12);
}
```

| Metric           | Value                                       |
| ---------------- | ------------------------------------------- |
| **Duration**     | 96 turns (4 real days at 1 turn/hour)       |
| **Rating floor** | CCC (lowest tier)                           |
| **Score cap**    | 12 (below CCC threshold of 15)              |
| **Extension**    | Multiple defaults extend the penalty window |

The penalty prevents corporations from immediately re-accessing credit markets at favorable rates.

## Distressed Debt Trading

### Market Price

Defaulted bonds trade at a fixed recovery value:

```typescript
// src/lib/constants/bonds.ts:314

if (defaulted) return 0.1; // 10 cents on the dollar
```

| State     | Price                         |
| --------- | ----------------------------- |
| Defaulted | 0.10 (10% of face)            |
| Matured   | 1.00 (par)                    |
| Active    | Market-based (0.05-2.0 range) |

### CEO Self-Buy Block

This is not specific to defaulted bonds: a CEO, pending CEO, or a character who was CEO within the last `EX_CEO_BOND_PURCHASE_BLOCK_TURNS` (120 turns) cannot purchase ANY of their own corporation's bonds, defaulted or not (CEO ⊥ bondholder invariant):

```typescript
// src/app/api/bonds/[bondId]/buy/route.ts:456-473

if (
  issuingCorp?.ceoId?.toString() === character._id.toString() ||
  issuingCorp?.pendingCeoCharacterId?.toString() === character._id.toString()
) {
  return NextResponse.json({ error: "Cannot buy your own corporation's bonds" }, { status: 400 });
}
if (wasCeoWithinTurns(issuingCorp, character._id, currentTurn, EX_CEO_BOND_PURCHASE_BLOCK_TURNS)) {
  return NextResponse.json(
    { error: "Previous CEOs cannot buy bonds in this corporation at this time." },
    { status: 400 }
  );
}
```

**Rationale:** Prevents CEOs (current, pending, or recently departed) from profiting off their own corporation's distress by buying its debt cheaply, including retiring defaulted debt at face value via buyback.

### CEO Debt Retirement

CEOs can retire defaulted bond units from the public float at **full face value** ($1,000/unit):

```typescript
// src/app/api/bonds/[bondId]/buyback/route.ts

const costPerUnit = BOND_UNIT_FACE_VALUE; // $1,000 flat
const totalCost = units * costPerUnit;

// Deduct from corporate liquidCapital
// Reduce bond.totalIssued and publicFloat
```

**Strategy:** Allows gradual debt reduction even when the corporation's bonds trade at distressed prices.

## Refinancing Defaulted Debt

CEOs can refinance defaulted principal by issuing new bonds:

```typescript
// src/lib/bonds/corporateBondDefault.ts:166-232 (previewRefinanceIssuance)

export function previewRefinanceIssuance(params: {
  corporation: Corporation;
  liquidCapitalAnchor: number; // ₳-normalized, caller-converted
  allNonMaturedBonds: Bond[];
  actualFaceAnchor: number; // new-bond face value in ₳
  sectorNpv: number;
  annualIncome: number;
  primeRate: number;
  currentTurn: number;
  fxByCurrency: ReadonlyMap<CurrencyCode, number>;
  maturityTurns?: BondMaturityTurns;
}): {
  creditRating: ReturnType<typeof calculateCreditScore>;
  couponRate: number;
};
```

### Eligibility Check

```typescript
// src/lib/bonds/corporateBondDefault.ts:244-258 (canRefinanceDefaultedDebt)

export function canRefinanceDefaultedDebt(params: {
  equity: number;
  existingDebtAllNonMatured: number;
  defaultedPrincipal: number;
}): { ok: boolean; requiredFace: number; maxAllowedFace: number };

const requiredFace = roundFaceToBondUnits(params.defaultedPrincipal);
const maxAllowed = maxNewIssuanceFaceValue(params.equity, params.existingDebtAllNonMatured);
// ok = requiredFace <= maxAllowed && requiredFace >= MIN_BOND_ISSUANCE
```

### 2× Equity Cap

New bond issuance is capped at 2× equity minus existing debt:

```typescript
// src/lib/bonds/corporateBondDefault.ts:152-155 (maxNewIssuanceFaceValue)

export function maxNewIssuanceFaceValue(equity: number, existingDebt: number): number {
  const cap = Math.max(0, equity * MAX_BOND_ISSUANCE_FRACTION - existingDebt);
  return roundFaceToBondUnits(cap); // Rounded to $1k units
}
```

| Equity | Existing Debt | Max New Issuance |
| ------ | ------------- | ---------------- |
| $1M    | $500k         | $1.5M            |
| $500k  | $1M           | $0               |
| $2M    | $2M           | $2M              |

## Dissolution Settlement

When a corporation dissolves, bond holders have priority claims on remaining assets.

### Settlement Preview

```typescript
// src/lib/bonds/corporateBondDefault.ts:278

export function previewDissolveSettlement(
  corp: Corporation,
  sectorNpv: number,
  bonds: Bond[],
  liquidCapitalAnchor: number,
  fxByCurrency: ReadonlyMap<CurrencyCode, number>,
  options?: { plantsEnabled?: boolean; sectorBookAnchor?: number }
): DissolveSettlementPreview {
  const lc = Math.max(0, liquidCapitalAnchor);
  // Only a salvage fraction of sector value is recoverable on dissolution
  // (sectors are abandoned to the unowned market, no buyer at going-concern price).
  const salvageBasis =
    options?.plantsEnabled === true ? (options.sectorBookAnchor ?? 0) : sectorNpv;
  const salvagedSectorNpv = DISSOLUTION_SECTOR_SALVAGE_FRACTION * Math.max(0, salvageBasis); // 0.2
  const totalAssets = lc + salvagedSectorNpv;
  const totalBondClaims = sumNonMaturedBondPrincipal(bonds, fxByCurrency);
  const bondRecoveryPool = Math.min(totalAssets, totalBondClaims);
  const shareholderPool = Math.max(0, totalAssets - bondRecoveryPool);
  const bondRecoveryPct =
    totalBondClaims > 0 ? Math.round((bondRecoveryPool / totalBondClaims) * 10_000) / 100 : 100;
}
```

Sector value counts at only **20%** on dissolution (`DISSOLUTION_SECTOR_SALVAGE_FRACTION`, `src/lib/constants/corporations.ts:91`), not at full NPV. Assets available for bond recovery are `liquidCapital + 0.2 x sectorValue`, not `liquidCapital + sectorValue`.

### Payout Priority

1. **Bond holders**, Paid first from `bondRecoveryPool` (up to total bond claims)
2. **Shareholders**, Receive `shareholderPool` (remaining assets after bond claims)

| Scenario      | Bond Recovery | Shareholder Recovery |
| ------------- | ------------- | -------------------- |
| Assets > Debt | 100%          | Remaining            |
| Assets = Debt | 100%          | 0%                   |
| Assets < Debt | Pro-rata      | 0%                   |

### Shareholder Allocation

```typescript
// src/lib/bonds/corporateBondDefault.ts:375

export function allocateShareholderPool(
  corp: Corporation,
  shareholderPool: number,
  nameById: Map<string, string>
): ShareholderAllocation {
  const totalShares = corp.totalShares ?? 0;
  for (const sh of corp.shareholders ?? []) {
    const payout = Math.floor((shareholderPool * sh.shares) / totalShares);
    // routed into characterRows, corporationRows, fundRows, or publicFloatRow
    // depending on the holder type
  }
}
```

## Bond Holder Merging

When multiple bonds default, holder positions are merged for consolidated tracking:

```typescript
// src/lib/bonds/corporateBondDefault.ts:449-483 (mergeDefaultedBondHolders)

export function mergeDefaultedBondHolders(defaultedBonds: Bond[]): {
  holderUnits: Map<string, { characterId: ObjectId; units: number }>;
  imperialHolderUnits: Map<string, { imperialCharacterId: ObjectId; units: number }>;
  corpHolderUnits: Map<string, { corporationId: ObjectId; units: number }>;
  publicFloat: number;
};
```

**Purpose:** Aggregates holdings across multiple defaulted bonds for settlement calculations.

## Credit Rating Calculation

The composite credit score uses four weighted components:

```typescript
// src/lib/constants/bonds.ts:122-127 (CREDIT_RATING_WEIGHTS)

export const CREDIT_RATING_WEIGHTS = {
  debtToEquity: 0.3, // Lower ratio = better
  interestCoverage: 0.25, // Higher coverage = better
  profitability: 0.25, // Positive ROE = better
  liquidity: 0.2, // Cash vs interest obligations
};
```

### Component Formulas

| Component         | Formula                                                    | Range |
| ----------------- | ---------------------------------------------------------- | ----- |
| Debt-to-Equity    | `100 - (D/E / 3) × 100`                                    | 0-100 |
| Interest Coverage | `coverage × 20`                                            | 0-100 |
| Profitability     | `40 + ROE × 350` (positive) / `40 - 50 × √loss` (negative) | 5-100 |
| Liquidity         | `20 + liquidityRatio × 40`                                 | 0-100 |

### Inertia Smoothing

Credit scores blend 75% new + 25% previous to prevent single-turn volatility:

```typescript
// src/lib/constants/bonds.ts:220-224 (inertia smoothing)

if (options?.previousCompositeScore != null && options.previousCompositeScore > 0) {
  compositeScore = Math.round(0.75 * rawComposite + 0.25 * options.previousCompositeScore);
}
```

### Rating Thresholds

`CREDIT_RATING_SPREADS` (`src/lib/db/types/centralBank.ts`) gives the base spread over prime by tier; corporate coupons add two more legs on top (see below).

| Rating | Threshold | Spread (over prime) |
| ------ | --------- | ------------------- |
| AAA    | 85+       | 0%                  |
| AA     | 70+       | 0.5%                |
| A      | 55+       | 1.5%                |
| BBB    | 40+       | 3%                  |
| BB     | 25+       | 5%                  |
| B      | 15+       | 8%                  |
| CCC    | 0+        | 12%                 |

### Corporate Coupon Rate

`getBondCouponRate` (`src/lib/constants/bonds.ts`) builds the actual **corporate** bond coupon from four legs, not the tier spread alone:

```
couponRate = primeRate + CREDIT_RATING_SPREADS[rating] + CORPORATE_BOND_SPREAD_PREMIUM + termPremium
```

- `CORPORATE_BOND_SPREAD_PREMIUM` = 1.0pp, added on every corporate issuance (sovereign/treasury issuance skips this leg and uses prime + tier spread alone).
- `termPremium` comes from `CORPORATE_BOND_TERM_PREMIUMS`, keyed by maturity in turns: 0pp at 48 and 96 turns, 1.0pp at 240 turns, 1.75pp at 336 turns.

## Key Files

| File                                          | Purpose                                              |
| --------------------------------------------- | ---------------------------------------------------- |
| `src/lib/turn/bondTurn.ts`                    | Default detection, penalty application, bond marking |
| `src/lib/bonds/corporateBondDefault.ts`       | Refinance previews, dissolution math, holder merging |
| `src/lib/constants/bonds.ts`                  | Credit scoring, coupon rates, market pricing         |
| `src/app/api/bonds/[bondId]/buy/route.ts`     | Purchase logic (CEO block)                           |
| `src/app/api/bonds/[bondId]/buyback/route.ts` | CEO debt retirement                                  |
| `src/lib/db/types/bond.ts`                    | `Bond`, `defaulted`, `defaultedAtTurn` fields        |

## Related Documentation

- [Corporations](./corporations.md), Bond issuance, sector NPV, corporate finance
- [Sovereign Bonds](./sovereign-bonds.md), Government debt (cannot default)
- [Stock Market](./stock-market.md), Bond trading interface, market dynamics
