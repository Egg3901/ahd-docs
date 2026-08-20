# Resources & Extraction Contracts

Extractable resources model sovereign ownership of natural wealth. States hold an extraction capacity ceiling (a daily basis, not a fixed per-turn amount); corporations can hold exclusive contracts granting them a share of that capacity. Uncontracted capacity flows freely to all extraction sectors in the state.

## Extractable Resources

Six resources can be extracted, defined by `EXTRACTABLE_RESOURCES` in `src/lib/constants/commodities.ts`:

| Resource    | Unit  | Typical role                                                                                       |
| ----------- | ----- | --------------------------------------------------------------------------------------------------- |
| Oil         | bbl   | Energy sector primary input                                                                         |
| Coal        | tons  | Energy / industrial input                                                                           |
| Iron        | tons  | Industrial / construction input                                                                     |
| Natural Gas | MMBtu | Energy sector input                                                                                 |
| Timber      | m³    | Construction / paper input                                                                          |
| Rare Earth  | tons  | Tech sector strategic input; merged commodity (copper + rare earth minerals, demand-weighted blend) |

These are a subset of the 28 commodity types tracked in the commodity pricing engine (`docs/design/commodities.md`, `COMMODITY_TYPES` in `src/lib/constants/commodities.ts`). Standard commodities (steel, electronics, etc.) have no extraction capacity model. Copper is not a separate extractable resource; it was folded into `rare_earth`.

## Capacity Model

Each state holds a `stateResourceCapacity` document specifying, per resource, the maximum extraction output ceiling in commodity units on a **daily** basis (the same basis as `sector.revenue` and `capitalStock`; a turn is a fraction of a day on the money timescale, so reading this as units/turn overstates the ration). Values are seeded from real-world production benchmarks and are updated via the admin panel.

```
stateResourceCapacity: {
  stateId: "TX",
  countryId: "US",
  resources: { oil: 300_000, natural_gas: 1_500_000, coal: 10_000, ... }
}
```

States with no capacity document are uncapped: all extraction sectors operate at full computed output (backward-compatible default).

**Capacity is not strictly fixed over time.** R&D breakthroughs for extraction corps permanently `$inc` per-resource capacity on the sector's state (see `docs/design/corporations.md` → "R&D Budget & Innovation"). The increase is weighted by the sector's active strategy supply map, so `oil_gas` breakthroughs grow oil + natural gas, `iron_mining` grows iron only, etc. This is by design: R&D "unlocks new deposits." States with no capacity document are still skipped: the innovation phase does not auto-insert docs.

## Extraction Contracts

A contract grants a named corporation an exclusive share (0% to 100%) of a state's capacity for a specific resource:

```
extractionContract: {
  stateId, countryId, corporationId, resource,
  share: 0.5,           // fraction of state capacity reserved
  grantedTurn, grantedBy, grantedByLevel: "state" | "national",
  revokedTurn?: number  // absent = active; set = revoked
}
```

- **Over-allocation:** contracts can sum past 100%. Contracted sectors are each capped to their allocated share; remaining open-access pool collapses to zero.
- **Revocation:** soft-delete via `revokedTurn`. Revoked contracts are excluded from all queries (`revokedTurn: { $exists: false }`).

## Turn Processing Integration

Each turn in `commodityPriceTurn.ts`:

1. Fetch `stateResourceCapacity` docs for all states with extraction sectors.
2. Fetch active contracts (non-revoked).
3. For each extraction sector, compute revenue-based output per resource.
4. Call `computeExtractionCapacityMultipliers()` → `Map<sectorId, Map<resource, 0.0 to 1.0>>`.
5. Apply multipliers inside `computeRawSupplyDemand()`: only extraction sectors, only extractable resources.
6. Resulting supply feeds the global commodity price update.

**Multiplier rules (per state, per resource):**

- Contract holders are capped to `totalCapacity × share`. If output < cap → multiplier = 1 (not capped).
- Open-access pool = `totalCapacity × (1 − Σ contractedShares)`. If total open-access demand ≤ pool → multiplier = 1; otherwise proportional squeeze.
- Over-allocated states: open-access pool = 0, all uncontracted sectors produce nothing for that resource.
- States with no capacity doc: multiplier = 1 for all sectors (uncapped).

## Contract Lifecycle

```
Legislature grants → extractionContracts insert (grantedTurn = currentTurn)
  └─ effective on next turn's commodity price run

Legislature revokes → soft-delete (revokedTurn = currentTurn)
  └─ excluded from multiplier computation on next turn
```

## API Routes

| Method | Route                                    | Auth   | Purpose                                |
| ------ | ---------------------------------------- | ------ | -------------------------------------- |
| GET    | `/api/contracts/extraction`              | Public | List active contracts (filterable)     |
| POST   | `/api/contracts/extraction`              | Admin  | Grant a contract                       |
| DELETE | `/api/contracts/extraction/[id]`         | Admin  | Revoke a contract (soft delete)        |
| GET    | `/api/states/[id]/resources`             | Public | State capacity + contracts + output    |
| GET    | `/api/map/resources`                     | Public | Country-wide choropleth data           |
| GET    | `/api/admin/resource-capacity`           | Admin  | List all capacity docs                 |
| PATCH  | `/api/admin/resource-capacity/[stateId]` | Admin  | Set/update a state's resource capacity |

**GET /api/contracts/extraction** query params: `stateId`, `corporationId`, `resource`, `countryId`.

**POST /api/contracts/extraction** body:

```json
{
  "stateId": "TX",
  "corporationId": "<24-char ObjectId>",
  "resource": "oil",
  "share": 0.5,
  "grantedBy": "<legislature ID>",
  "grantedByLevel": "state" | "national",
  "force": false
}
```

If the new contract would over-allocate and `force` is false, the server returns **409** with `{ overAllocated: true, needsConfirmation: true }` without inserting. The client must re-submit with `force: true` to proceed.

## UI Surfaces

| Surface                         | Location                                    | Read                              | Admin actions  |
| ------------------------------- | ------------------------------------------- | --------------------------------- | -------------- |
| State Resources tab             | `/country/[code]/region/[id]?tab=resources` | Capacity + contracts + output     | Grant / Revoke |
| Corporation Contracts section   | `/corporation/[id]`                         | Own contracts                     | -              |
| National Congress Contracts tab | `/country/[code]/congress?tab=contracts`    | Country contracts                 | Grant / Revoke |
| Country map Resources mode      | `/country/[code]/map`                       | Choropleth by capacity/allocation | -              |

## Key Files

- `src/lib/db/types/extractionContract.ts`: Contract document type
- `src/lib/db/types/stateResourceCapacity.ts`: Capacity document type
- `src/lib/db/collections/extractionContracts.ts`: Collection getter
- `src/lib/db/collections/stateResourceCapacity.ts`: Collection getter
- `src/lib/constants/commodities.ts`: `EXTRACTABLE_RESOURCES`, `ExtractableResource`
- `src/lib/turn/extraction/extractionCapacity.ts`: Multiplier computation (7 unit tests)
- `src/lib/turn/commodityPriceTurn.ts`: Integration point (extraction capacity block starts ~line 546)
- `src/app/api/contracts/extraction/route.ts`: GET + POST
- `src/app/api/contracts/extraction/[id]/route.ts`: DELETE
- `src/components/congress/GrantContractModal.tsx`: Grant form (over-allocation confirmation flow)
- `src/components/state/StatePageTabsResources.tsx`: State resources UI with admin grant/revoke
- `scripts/seeds/stateResourceCapacity.ts`: CLI wrapper for the capacity seed; data lives in `src/lib/seeds/reference/stateResourceCapacity.ts` (191 state entries across 18 countries; unlisted states default to zero capacity for every resource)

## Related Systems

- [Commodities](./commodities.md): Pricing engine that consumes extraction output
- [Corporations](./corporations.md): Sectors that produce commodity supply; extraction sectors are the direct consumers of contracts
