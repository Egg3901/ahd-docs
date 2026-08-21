# UK Elections

The UK uses 12 NUTS1-style regions for Commons, regional politics, demographics, budgets, and party organization. Older documentation that grouped the country into only England, Scotland, Wales, and Northern Ireland described a retired abstraction.

## Commons map

The modern `UK_COMMONS_SEATS` map in `src/lib/constants/states.ts` totals 650 seats:

| Code | Region                   | Seats |
| ---- | ------------------------ | ----: |
| LON  | London                   |    75 |
| SEE  | South East England       |    90 |
| SWE  | South West England       |    58 |
| EAE  | East of England          |    60 |
| EMI  | East Midlands            |    47 |
| WMI  | West Midlands            |    57 |
| YHU  | Yorkshire and the Humber |    54 |
| NWE  | North West England       |    75 |
| NEE  | North East England       |    27 |
| SCO  | Scotland                 |    57 |
| WAL  | Wales                    |    32 |
| NIR  | Northern Ireland         |    18 |

The 1953 preset uses a separate 625-seat map in `UK_COMMONS_SEATS_1953`. Seat allocation, historical officials, and election scheduling must all use the selected preset instead of assuming the modern map.

## Live allocation

- Commons elections use the configured `pr_hareQuota` method, a Hare-quota largest-remainder allocator.
- Each region resolves a multi-seat contest and writes weighted `seatsHeld` records.
- The lower chamber has a five-year maximum cycle, modeled as 240 turns, with snap elections available.
- Party organization is normalized within each region and raised to the 0.2 exponent in the election factor.
- General vote accumulation uses 50% early, 20% ramp, and 30% in the final four turns.

The UK model is proportional at the regional level. It is not a constituency-by-constituency FPTP simulation.

## Government formation

A party winning seats does not automatically appoint the Prime Minister. The Commons must seat a PM through the parliamentary confidence process. The configured majority threshold is 326 for a 650-seat modern chamber and is preset-aware for the 625-seat 1953 chamber.

If the government is pending:

- ordinary legislation is frozen;
- PM appointment votes can run;
- a 96-turn vacancy deadline is armed;
- expiry of that deadline can trigger a snap Commons election.

A successful no-confidence vote removes the PM and returns the country to the same pending formation flow. See [Parliamentary Government](./parliamentary-government.md), [Ruling-Party Confidence](./ruling-party-confidence.md), and [UK PM No Confidence](./uk-pm-no-confidence.md).

## Regional institutions

Scotland, Wales, and Northern Ireland use their named devolved legislatures. The nine English regions use regional councils. These are separate from Commons seat allocation and have their own seat maps and election scheduling.

## Source map

- `src/lib/constants/states.ts`: preset-aware Commons and regional-council seat maps
- `src/lib/constants/uk.ts`: region names and display metadata
- `src/lib/constants/countries.ts`: legislature, election method, threshold, and office configuration
- `src/lib/turn/perpetualElections.ts`: continuing and snap election coverage
- `src/lib/turn/election/seatAllocation.ts`: multi-seat allocation
- `src/lib/turn/parliamentaryGovernment.ts`: government formation
