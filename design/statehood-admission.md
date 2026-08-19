# Statehood Admission

## Overview

Era-windowed admission of US territories into full statehood: Alaska and Hawaii under the `1953-default` preset. Source: `src/lib/elections/statehoodAdmission.ts`.

Statehood is defined by presence in the active apportionment map (`HOUSE_SEATS` per preset, see `initializeOfficials`: "the apportionment map is what defines statehood"). That map is a frozen per-preset constant. A territory absent from it, like Alaska/Hawaii under `1953-default`, is seeded but seatless and cannot become a state through `runCensus` alone, census reapportions seats among existing states, it never admits a new one. This module supplies the missing transition.

Design law: **gravity, not rails**. Admission is not scripted to fire in a specific year. Each territory carries a window and a cumulative admission curve whose median lands on the historical year, so an untouched world usually admits Alaska and Hawaii around 1959, sometimes earlier (1956), sometimes later (up to 1970). It is a pull, not a timetable.

## Territory Table

`TERRITORY_ADMISSIONS`:

| `stateId` | Name | `historicalYear` | `windowStartYear` | `windowEndYear` |
| --- | --- | --- | --- | --- |
| `AK` | Alaska | 1959 | 1950 | 1970 |
| `HI` | Hawaii | 1959 | 1950 | 1970 |

`historicalYear` is the **median** of the admission curve, not a scripted fire date. The window opens in 1950 (Alaska Statehood Committee era) and closes in 1970; a world that still holds a territory as of `windowEndYear` admits it outright. Later presets (`1979-default` and after) already carry both states in their apportionment maps, so this table is only consulted for territories missing from the active map.

## Admission Curve

`ADMISSION_CDF_AT_HISTORICAL_YEAR = 0.5`, probability of admission by the end of the historical year is exactly 0.5, which is what makes that year the median.

`INITIAL_HOUSE_SEATS_ON_ADMISSION = 1`, constitutional floor of House seats a newly admitted state receives (recalculated at the next census).

`POST_WINDOW_RAMP_EXPONENT = 0.7`, curvature of the ramp after the historical year. Below 1, so probability climbs fast then flattens: a world that misses the historical moment resolves soon after rather than drifting to the window's end. Tuned to 0.7 rather than 0.5 (square root) because a square-root ramp put too much probability mass in the single year right after the anchor, making that year, not the historical year, the modal admission year. `statehoodAdmission.test.ts` pins the historical year as the modal year to prevent regression.

`admissionCdf(t, year)`, piecewise:

- `0` before `windowStartYear`.
- `1` at or after `windowEndYear`.
- **Before** `historicalYear`: quadratic ramp from 0 to 0.5 (pressure builds, a straight line would make 1950 as likely as 1958, understating a decade-long statehood movement).
- **After** `historicalYear`: `0.5 + 0.5 * progress^0.7` ramp toward 1.

`admissionHazard(t, year) = (F(y) - F(y-1)) / (1 - F(y-1))`, the per-year conditional probability implied by the CDF. Rolling this once a year reproduces the CDF exactly.

## Roll and Decision

`admissionRoll(stateId, year, iteration)`, deterministic `[0,1)` draw via `hashToUint32("statehood:{iteration}:{stateId}:{year}")`. Keyed on the world's iteration (worlds diverge) and the year, not the turn (idempotent, replaying a turn cannot re-roll the same year). Turn-processing paths must never use `Math.random()`.

`decideAdmissions(candidates, year, iteration)`, for each candidate territory, computes the year's hazard and admits it if the roll clears the hazard. Returns `AdmissionDecision[]` (`stateId`, `name`, `year`, `hazard`). Callers must pre-filter `candidates` to exclude territories already states under the active apportionment map or already admitted in an earlier year, this function only evaluates the roll, not world state.

## Reading Admission State

`admittedStateIdsAsOf(states, asOfYear)` is the single reader of the `admittedYear` field on state documents: returns state ids with `admittedYear <= asOfYear`. Every statehood gate goes through it, apportionment, seat creation, bootstrap officials, and the perpetual-election spawner. These previously tested `getHouseSeats(preset)[id] != null` directly, which can never become true mid-game; a gate that bypasses this reader silently keeps an admitted state a territory in its own corner of the game.

`isUsPoliticalState(stateId, preset, admittedIds)`, true when a US region hosts full state politics this era: either House seats under the active apportionment map, or `admittedIds` (mid-game admission). DC fails (not an electoral state per `isUsElectoralState`); AK/HI fail under `1953-default` until admitted.

`isUsResidentPoliticalRegion(stateId, preset, admittedIds)`, true when a region can be a player's political home: `isUsPoliticalState` OR listed in `TERRITORY_ADMISSIONS`. Alaska and Hawaii start as territories under `1953-default`, residents can organize parties and elect a territorial governor, but gain no House/Senate/state-legislative seats until `isUsPoliticalState` passes.

## Admission Content

`buildAdmissionContent(decisions)` builds the news-post body: singular ("X is admitted to the Union in {year}, taking its seats in the House and Senate. House apportionment will be recalculated at the next census.") or a joined list for simultaneous admissions. Empty string if `decisions` is empty.
