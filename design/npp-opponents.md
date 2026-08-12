# NPP Opponents Guide

Non-Player Politicians (NPPs) are AI-controlled politicians that fill offices, run in elections, and vote on legislation. Understanding their behavior gives you a competitive edge.

## NPP Election Behavior

NPPs autonomously enter elections each turn based on their ambition:

- **Empty races** — 92% entry chance (NPPs rush to fill vacancies)
- **Races with candidates** — 55% at maximum ambition
- **Player presence** — Entry chance halved when players are already in the race
- **Preference** — NPPs target uncrowded races with no players first

### NPP Advantages

- They maintain a **minimum 10% Political Influence** (floor that doesn't decay)
- They start with realistic policy positions based on party
- They have real politician avatars and names

### NPP Disadvantages

- **50% score penalty** when competing against player characters in primaries (`NPP_PRIMARY_SCORE_MULTIPLIER = 0.5`)
- **20% vote-weight penalty** in general elections when a player is in the race (`NPP_GENERAL_WEIGHT_MULTIPLIER = 0.8`)
- They **drop out** if their appeal falls below 20% of the maximum
- They can't strategically time their campaigns
- They can't run ads or fundraise strategically

## Beating NPPs

### In Primaries

1. **Enter early** — Your presence halves NPP entry chance and triggers their penalty
2. **Build influence** — NPPs have a floor of 10%; exceed it significantly
3. **Stay ideologically aligned** — NPPs close to party median; match or exceed their alignment
4. **One race at a time** — NPPs can only be in one primary at once; if they're in yours, they can't be elsewhere

### In Generals

1. **Leverage your party org** — NPPs benefit from party org too, but you can actively improve it
2. **Campaign actively** — NPPs can't canvass or run targeted ads
3. **Target their weak demographics** — NPPs have fixed positions; find demographics they don't appeal to

## NPP Influence System

You can influence NPPs through the influence action system:

- **Endorse Candidate** — Get an NPP to support your candidacy
- **Oppose Candidate** — Turn an NPP against your opponent
- **Support Leadership** — Build NPP support for your party leadership bid
- **Withdraw from Election** — Convince an NPP to drop out of a race you want

Party chairs and vice chairs can influence same-party NPPs using party resources.

## NPP Bill Voting

NPPs vote on legislation based on ideology alignment:

- Votes weighted by ideology match with bill provisions
- Weighted by seats held (more senior NPPs have more impact)
- Understanding their voting tendencies helps when proposing bills

## Related Pages

- [[NPP System]] — Full NPP mechanics documentation
- [[Election Mechanics]] — How elections work
- [[Campaign Strategy]] — Overall strategy guide
