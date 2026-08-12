# Commodities

Commodities model inputs and outputs between corporate sectors. Prices move with global and regional supply and demand, and feed into sector profit margins.

## Overview

27 commodity types trade across the economy:

| Category       | Commodities                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Extractable    | Iron Ore, Coal, Crude Oil, Copper, Natural Gas, Timber, Rare Earth                                                |
| Industrial     | Steel, Electronics, Chemicals, Plastics, Ordnance                                                                 |
| Energy & Fuels | Electricity (Energy), Fertilizers, Pharmaceuticals, Vehicles                                                      |
| Food           | Food Products                                                                                                     |
| Construction   | Building Materials, Construction Services                                                                         |
| Services       | Software, Financial Services, Healthcare Services, Real Estate Services, Advertising, Consulting, Freight, Retail |

Each sector type supplies and demands specific commodities at rates tied to sector revenue. **Retail** demands many inputs and supplies the Consumer Goods (`retail`) commodity. Only **owned** corporate sectors participate in a state's commodity flow.

## Pricing

Each turn, prices update from supply and demand using logarithmic scaling with no hard cap:

```
ratio = demand / supply
if ratio >= 1: price = basePrice × (1 + 0.7 × ln(ratio))    # shortage
else:          price = basePrice / (1 + 0.7 × ln(1/ratio))   # oversupply
```

Blended price for display: **50% global** + **25% national** (country aggregate) + **25% regional** (state-level). A global stabilizer (`BASE_COMMODITY_SUPPLY_DEMAND = 50,000`) on each side prevents extreme swings. A national stabilizer (`NATIONAL_COMMODITY_STABILIZER = 500`) prevents degenerate ratios in small countries.

Macro-driven commodities (financial services, healthcare services, advertising, real estate services) use a 50/50 global/national blend because state-level activity is meaningless for nationally-driven demand.

## Margins

Margin modifiers are computed independently at global, national, and state level, then blended 50/25/25 — matching the price blend:

```
globalMod   = -K × Σ(rate_i × ln(D_global_i / S_global_i))
nationalMod = -K × Σ(rate_i × ln(D_national_i / S_national_i))
stateMod    = -K × Σ(rate_i × ln(D_state_i / S_state_i))
rawMod = 0.5 × globalMod + 0.25 × nationalMod + 0.25 × stateMod
```

With `COMMODITY_LOG_K = 40`, shortages are meaningful but manageable:

| Scenario (rate=0.25) | Ratio | Margin hit |
| -------------------- | ----- | ---------- |
| Mild shortage        | 1.1×  | -1.0%      |
| Moderate             | 1.4×  | -3.4%      |
| Severe               | 2.0×  | -6.9%      |
| Extreme              | 5.0×  | -16.1%     |

Sellers in scarce markets get an equivalent **surplus bonus** (same formula, positive sign).

**Per-commodity soft cap:** No single commodity can contribute more than ±50 percentage points to the modifier (`COMMODITY_PER_ITEM_CAP = 50`).

**Aggregate caps:** After blending, the combined input modifier is floored at `−COMMODITY_AGGREGATE_INPUT_CAP (30)` and the surplus modifier is ceilinged at `+COMMODITY_AGGREGATE_SURPLUS_CAP (30)`. This prevents stacked multi-commodity pressure from commercially destroying a sector under routine market conditions.

**State stabilizers:** A state-level stabilizer prevents extreme ratios when a state has zero local supply, applied only in the margin path (state prices remain fully dynamic).

- Standard commodities: `STATE_COMMODITY_SUPPLY_DEMAND = 250`
- Extractable resources (oil, gas, iron, copper, timber, coal, rare earth): `EXTRACTABLE_RESOURCE_STATE_STABILIZER = 2500` — these are globally traded so local absence doesn't mean local unavailability.

**Retail penalty:** Retail sectors take only **25%** of negative input penalties (`RETAIL_NEGATIVE_COMMODITY_PENALTY_FACTOR`), reflecting substitution power.

## Commodity Page

The commodity detail page shows:

- **Hero image** — A banner image sourced from Wikimedia Commons giving each commodity a visual identity
- **Stats strip** — Key metrics (price, supply, demand, balance) in a compact hero strip at the top
- **Combined charts** — Price history and supply/demand charts merged into a single card with a toggle button
- **World map** — Interactive map showing supply or demand intensity per country with color-coded shading. Click a country to see a stat card, then drill into state/region-level breakdowns (US states, UK regions). Toggle between supply and demand views. Powered by `src/lib/commodity-map/` utility layer
- **Regional breakdown** — Collapsible table grouped by country with friendly region names, sorted by volume
- **Top producers and consumers** by volume
- **Synthetic demand sources** — "Base Economic Demand" (stabilizer) and "GDP-Scaled Retail Demand" (retail channel demand) appear as system entries in the Top Consumers list, showing where non-corporate demand originates

## In-game UI

- **Commodity detail** — `/commodity/[type]` with hero image, world map, charts, and market context.
- **Sector pages** — Commodity rows link into that detail.
- **Corporations** — Sector economics interact with commodity flows; see [[Corporations]].

### Key Files

- `src/lib/constants/commodities.ts` — All commodity constants, supply/demand maps, pricing, and margin modifier functions
- `src/lib/turn/commodityPriceTurn.ts` — Per-turn price calculation and history snapshots
- `src/lib/commodity-map/` — World map utilities: aggregation, color scales, country→SVG registry, region mappings
- `src/app/commodity/[type]/page.tsx` — Commodity detail page with hero, map, charts
- `src/app/commodity/[type]/components/` — World map, stat card, drill-down, region map, legend, and mode toggle components
- `src/app/api/commodities/` — Commodity API routes

## Related pages

- [[Corporations]] — Sectors, splits, revenue, and corporate bonds
- [[Stock Market]] — Where market-wide instruments are listed
- [[Formula Deep-Dive]] — Turnout, influence, and other numeric systems
