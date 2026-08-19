# Germany, Elections

## Electoral System

Germany uses **AMS** (Additional Member System / MMP) for the Bundestag: half the seats are direct constituency wins, the other half are compensatory list seats allocated per Land to bring each party's total seats in line with its list vote share. Constituency + top-up computation lives in `germanyAMS.ts`; this document covers the **Landesliste** (state list) management layer that feeds the list-seat half. Source: `src/lib/elections/germanyLandesliste.ts`.

## Landesliste

A Landesliste is an ordered list of a party's candidates within one Bundesland. When a party wins list seats in a Land, the top N candidates on that party's list for that Land fill those seats in order. Stored in the `landeslisten` collection, keyed by `(countryId: "DE", partyId, landId, cycle)`.

## Auto-Generation

`autoGenerateLandesliste(db, { partyId, landId, cycle, preserveExisting? })`:

- Ranks the party's members resident in that Land (`homeState === landId`) by `nationalInfluence` descending; members without NPI sort to the bottom in `ObjectId` order (a stable-ish tiebreak across runs).
- Upserts by `(countryId: "DE", partyId, landId, cycle)`.
- If the existing list is `lockedAt`, this is a no-op regardless of `preserveExisting`, a locked list cannot be regenerated.
- If `preserveExisting: true` and an unlocked list already exists, returns it unchanged instead of overwriting chair edits.

`generateLandeslistenForCycle(db, cycle)` runs this for every distinct `(party, Land)` pair with at least one resident DE member, concurrently (`Promise.all`), always with `preserveExisting: true`. Called at Bundestag spawn so chairs have an edit window before the list is consumed by the AMS resolver.

## Chair Edits

`reorderLandesliste(db, { partyId, landId, cycle, candidates, authoredBy? })` lets a party chair reorder or replace the list before it locks:

- Throws if no list exists for the `(partyId, landId, cycle)` key.
- Throws if the existing list is already `lockedAt`.
- Throws if `candidates` contains a duplicate id.
- Throws if any candidate is not a `DE` party member resident in that Land (validated against `characters` with `party`, `homeState` matching).
- On success, replaces `candidates` and stamps `updatedAt` (and `authoredBy` if provided).

## Locking

`lockLandesliste(db, { partyId, landId, cycle })` sets `lockedAt` on the list, permanently blocking further chair edits. Called at cycle start, after which the AMS seat resolver treats list order as final.

## Reading

`getLandesliste(db, { partyId, landId, cycle })`, direct lookup by the `(countryId: "DE", partyId, landId, cycle)` key; returns `null` if not found.

## Lifecycle Summary

| Stage | Function | State |
| --- | --- | --- |
| Cycle start (spawn) | `generateLandeslistenForCycle` → `autoGenerateLandesliste` (`preserveExisting: true`) | Unlocked, NPI-ranked |
| Edit window | `reorderLandesliste` (party chair action) | Unlocked, chair-ordered |
| Cycle lock | `lockLandesliste` | `lockedAt` set, immutable |
| Seat resolution | AMS resolver (`germanyAMS.ts`) reads `candidates` in order to fill list seats | Consumed |

## Related

- Constituency + compensatory seat math: `src/lib/elections/germanyAMS.ts` (not covered here).
- Country config: `COUNTRY_CONFIGS.DE` in `src/lib/constants/countries.ts` defines the Bundestag's election type key (`bundestag`), which also drives its inclusion in `WESTMINSTER_STYLE_TYPES` and `NATIONAL_AGGREGATION_TYPES` for the live-results national board, see `live-election-results.md`.
