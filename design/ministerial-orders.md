# Ministerial Orders

Design doc for the ministerial order lifecycle: issuance, active-window tracking,
expiry, and per-turn effect application. Ministerial orders are the discretionary
lever cabinet-position holders spend ministerial actions on, distinct from tier
settings and regional targets (also cabinet levers, but persistent rather than
timed).

**Lifecycle location:** `src/lib/cabinet/ministerialOrderLifecycle.ts`
**Issuance route:** `POST /api/country/[code]/executive/cabinet/[positionId]/order`
**Turn application:** `src/lib/turn/ministerialOrderProcessing.ts`

## Data model

```typescript
interface MinisterialOrder {
  _id: ObjectId;
  countryId: CountryId;
  positionId: string;
  characterId: ObjectId | null; // null when issued by an NPP minister
  isNPP?: boolean;
  nppId?: ObjectId;
  orderId: string;
  orderName: string;
  effects: Array<{
    metric: string;
    modifier: number;
    scope: "national" | "regional";
    regionId?: string;
  }>;
  issuedAt: Date;
  issuedTurn: number;
  duration?: number; // turn count issued for; used to recompute expiry on legacy rows
  expiresTurn: number;
  active: boolean;
  createdAt: Date;
}
```

Collection: `getMinisterialOrdersCollection(db)`
(`src/lib/db/collections/cabinetSettings.ts`).

`DEFAULT_ORDER_DURATION = 24` turns (one game half-year), `src/lib/constants/cabinetMechanicsTypes.ts`.

## Expiry resolution

Expiry is derived, not just read off `expiresTurn`, so legacy or wrong-typed rows
self-heal:

```typescript
export function computeMinisterialOrderExpiresTurn(
  issuedTurn: number,
  duration: number = DEFAULT_ORDER_DURATION
): number {
  return issuedTurn + duration;
}

export function resolveMinisterialOrderExpiresTurn(order: OrderExpiryFields): number {
  if (order.duration != null && Number.isFinite(order.duration) && order.issuedTurn != null) {
    return computeMinisterialOrderExpiresTurn(order.issuedTurn, order.duration);
  }
  const coerced = Number(order.expiresTurn);
  if (Number.isFinite(coerced)) return coerced;
  return computeMinisterialOrderExpiresTurn(order.issuedTurn, DEFAULT_ORDER_DURATION);
}

export function isMinisterialOrderActive(
  order: Pick<MinisterialOrder, "active" | "expiresTurn" | "issuedTurn" | "duration">,
  currentTurn: number
): boolean {
  if (!order.active) return false;
  return resolveMinisterialOrderExpiresTurn(order) > currentTurn;
}
```

Resolution order: prefer `issuedTurn + duration` (authoritative when both are
present and numeric) over the persisted `expiresTurn`, then fall back to a coerced
`expiresTurn`, then to `issuedTurn + DEFAULT_ORDER_DURATION` as a last resort.

## Expiry sweep

```typescript
export async function expireMinisterialOrders(
  db: Db,
  currentTurn: number
): Promise<{ expired: number }>
```

Runs a two-pass sweep every turn (bug #0761 fix, legacy rows with missing or
string-typed `expiresTurn` were lingering `active: true` forever under a single
typed-query pass):

1. **Fast path:** `updateMany({ active: true, expiresTurn: { $lte: currentTurn } })`
, catches every well-typed row in one query.
2. **Stale sweep:** fetches all remaining `active: true` docs, recomputes expiry via
   `resolveMinisterialOrderExpiresTurn` for each, and force-deactivates any that
   should have expired but didn't match the fast-path filter (wrong type, missing
   field).

Also called defensively at order-issuance time (see below), so a stale still-active
row from a prior turn cannot block a fresh order of the same type from being issued.

## Issuance

`POST /api/country/[code]/executive/cabinet/[positionId]/order`, auth: cabinet
holder for that position, or admin.

1. Resolve `mechanics` and `availableOrders` for the country/position; 404 if the
   position or order config is unknown.
2. Regional-scope orders require a `targetRegionId`, rejected up front with 400
   (`"Select a target region"`) rather than silently dropping the effect at turn
   time, since the turn engine only applies regional effects that carry a
   `regionId`.
3. Auth check: `member.characterId` must match the caller's character, or the caller
   is admin.
4. Backfill legacy `cabinetMembers` docs missing `ministerialActions` /
   `lastMinisterialActionResetDay`, pre-fix nominations and admin force-confirms
   could insert members without these fields, which silently fails the atomic
   `$gte: 1` spend below (Mongo doesn't match `$gte` against a missing field).
5. Action-pool check: `member.ministerialActions >= 1`, else 400.
6. `expireMinisterialOrders(db, currentTurn)` runs first, then the route checks for
   an already-active order of the same `orderId` on that position, 409 if found.
7. Atomically decrement `ministerialActions` via `updateOne({ ministerialActions:
   { $gte: 1 } })`; 409 on race-lost spend.
8. Insert the order document with `expiresTurn: computeMinisterialOrderExpiresTurn
   (currentTurn, orderConfig.duration)`. On insert failure, the spent action is
   refunded (`$inc: { ministerialActions: 1 }`) before the error is rethrown.

Emergency orders (`emergencyOrderId = "emergency_" + positionId`) are a special
config synthesized from `mechanics.emergency` rather than looked up in
`availableOrders`; their effects are always `scope: "regional"`.

## Per-turn effect application

`processMinisterialOrders(currentTurn)` (`src/lib/turn/ministerialOrderProcessing.ts`)
runs every turn, all countries:

1. Expire completed orders (`expireMinisterialOrders`).
2. Fetch all `active: true` orders.
3. **Statecraft scaling:** each order's effect magnitude is scaled by the issuing
   minister's `statecraft` stat via `statMultiplier()` (gentle ±20%), read once per
   issuing character. Unmigrated ministers (no stat block) and orders with no
   resolvable issuer default to 1.0×.
4. Effects are bucketed per country under a `"orders"` source channel (kept separate
   from `"settings"`, `"military"`, `"estates"`, `"energy"`, `"infrastructure"`, the
   #1129 split-by-channel model, so a saturated order book doesn't zero out a
   newly-built estate's contribution).
5. Inflation-pressure metrics (`inflationPressure`, `inflationRate` leaves) are
   routed to `centralBanks.policyInflationPressure`, not into `stateMetrics`, a
   national monetary concept regardless of the effect's declared `scope`.
6. All other effects are merged across channels, scaled by
   `CABINET_EFFECT_STRENGTH` (**1.25**), then clamped to
   `MAX_PER_METRIC_MODIFIER_PER_TURN` (**0.08**) per metric per turn, the hard
   ceiling that stops a fully-staffed cabinet stacking 10+ active orders into
   runaway compounding (bug #0571 guarantee).
7. Macro-scale metrics (per-100k crime rate, per-pupil education spending, etc.) are
   additionally scaled by `modifierSpanScale(metricPath)`, which reads the metric's
   `THRESHOLDS` span so a 0-100-convention-authored modifier registers proportionally
   on a metric with a much larger real-unit range.
8. Applied via bulk `$inc` to `macroMetrics` for macro paths; political-pipeline
   countries additionally get their national + per-region deltas snapshotted into
   `politicalCabinetContribution` for the political-approval dynamics step.

## Related systems

- `src/lib/constants/cabinetMechanicsTypes.ts`, `MinisterialOrderConfig`,
  `MINISTERIAL_ACTION_CAP` (4), `DEFAULT_ORDER_DURATION` (24).
- `src/lib/cabinet/ministerialActionPool.ts`, `initialMinisterialActionFields()`,
  the legacy-member backfill used at issuance.
- `docs/design/cabinet.md`, cabinet position structure, tier settings, regional
  targets (the other two cabinet levers, both persistent rather than order-timed).
