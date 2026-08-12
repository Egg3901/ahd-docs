# A House Divided — Public API v1

Base URL: `https://ahousedividedgame.com/api/public/v1`

## Authentication

All endpoints require an `X-Bot-Token` header containing a valid `PUBLIC_BOT_API_KEY`.

```
X-Bot-Token: <your-key>
```

Contact the admin team to obtain a key.

## Rate limiting

60 requests per minute per IP / key. On limit: HTTP 429 with `Retry-After` header.

## Response envelope

Success:

```json
{ "ok": true, ... }
```

Error:

```json
{ "ok": false, "error": "Human-readable message", "code": "ERROR_CODE" }
```

Error codes: `UNAUTHORIZED`, `NOT_FOUND`, `BAD_REQUEST`, `RATE_LIMITED`, `INTERNAL_ERROR`.

## Stability contract

`/v1/` endpoints are additive-only. Fields may be added; existing fields will not be removed or renamed. Breaking changes will be released under `/v2/`.

All timestamps are UTC ISO 8601.

---

## Endpoints

### Character

#### `GET /character`

Query by name (partial match) or Discord ID.

| Param       | Type   | Required |
| ----------- | ------ | -------- |
| `name`      | string | one of   |
| `discordId` | string | one of   |

Response:

```json
{
  "ok": true,
  "found": true,
  "characters": [
    {
      "id": "...",
      "name": "Jane Smith",
      "bio": "...",
      "countryId": "US",
      "party": "Democratic Party",
      "partyId": "...",
      "partyColor": "#1a1aff",
      "partyUrl": "https://...",
      "state": "California",
      "stateCode": "CA",
      "stateUrl": "https://...",
      "countryUrl": "https://...",
      "position": "Senator",
      "officeType": "senate",
      "politicalInfluence": 42.5,
      "nationalInfluence": 18.2,
      "favorability": 55,
      "infamy": 3,
      "campaignFunds": 12500,
      "cashOnHand": 8000,
      "netWorth": 32500,
      "portfolioValue": 12000,
      "actions": 4,
      "donorBaseLevel": 2,
      "policies": { "economic": 25, "social": -10 },
      "avatarUrl": null,
      "discordAvatarUrl": null,
      "discordUsername": null,
      "profileUrl": "https://...",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "activeElection": null,
      "isCeo": false,
      "ceoOf": null,
      "isInvestor": true,
      "investorRank": 3
    }
  ]
}
```

#### `GET /character/:id/career`

Career history in reverse chronological order.

Response: `{ ok, found, characterId, characterName, career[{ type, office, officeLabel, party, electionId, fromState, toState }] }`

#### `GET /character/:id/achievements`

Earned achievements merged with definitions.

Response: `{ ok, found, characterId, characterName, achievements[{ id, name, description, icon, category, isHidden, isHighlighted, earnedAt }] }`

---

### Elections

#### `GET /elections`

| Param     | Type   | Required |
| --------- | ------ | -------- |
| `country` | string | yes      |
| `state`   | string | no       |

Response: `{ ok, found, elections[{ id, seatId, electionType, state, stateName, status, startTime, endTime, candidates[], finalVotes? }] }`

`finalVotes` is only present when `status` is `ended/completed/resolved`.

#### `GET /elections/:id`

Full election detail.

Response: `{ ok, found, election{ ... }, phase{ inPrimary, inGeneral, isUpcoming, isEnded }, incumbent (null if none), candidates[], primarySnapshots[{ turn, candidates[{ name, sharePct }] }], votes{ totalVotes, finalized, latestSnapshot } }`

---

### Party

#### `GET /party`

| Param     | Type   | Required |
| --------- | ------ | -------- |
| `id`      | string | yes      |
| `country` | string | yes      |

Response: `{ ok, found, party{ id, name, abbreviation, color, economicPosition, socialPosition, economicLabel, socialLabel, memberCount, seatCount, treasury, chairName, partyUrl, recentElectionResults[], topMembers[] } }`

---

### Government

#### `GET /government`

| Param     | Type   | Required |
| --------- | ------ | -------- |
| `country` | string | yes      |

Response: `{ ok, found, country, countryName, officials[], cabinet[], governmentFormation{ type, ... } }`

Parliamentary countries: `governmentFormation.type = "parliamentary"`, includes `seatsByParty[{ partyId, partyName, partyColor, seats }]`.

Presidential countries: `governmentFormation.type = "presidential"`, includes `president{ name, party, profileUrl }`.

---

### Country

#### `GET /country/:code`

Country summary with legislature composition.

Response: `{ ok, found, countryId, name, governmentType, population, currentLeader, legislatureComposition[{ partyId, partyName, partyColor, seats, seatPct }], lastElectionCycle }`

#### `GET /country/:code/economy`

Central bank data and macro indicators. History arrays contain up to 12 entries (1 game year).

Response: `{ ok, found, countryId, primeRate, inflation, gdpGrowth, chair{ name, profileUrl }, rateHistory[], inflationHistory[], gdpGrowthHistory[], stockMarket{ totalMarketCap, change1h, change24h, exchange } }`

#### `GET /country/:code/legislature`

Chamber composition and recent legislation. `pendingBills` and `recentlyPassed` are capped at 5 each; use `/legislation` for full browsing.

Response: `{ ok, found, countryId, chamber, totalSeats, composition[], pendingBills[], recentlyPassed[] }`

---

### Legislation

#### `GET /legislation`

| Param     | Type                      | Required        |
| --------- | ------------------------- | --------------- |
| `country` | string                    | no              |
| `status`  | `pending\|passed\|failed` | no              |
| `limit`   | number (max 100)          | no (default 20) |

Response: `{ ok, found, bills[{ id, title, sponsor, sponsorParty, country, status, introducedAt, votedAt, vote{ yes, no, abstain }, effects[{ metric, direction }] }] }`

---

### Corporation

#### `GET /corporation`

| Param  | Type                  | Required |
| ------ | --------------------- | -------- |
| `name` | string                | one of   |
| `id`   | string (sequentialId) | one of   |

Response: `{ ok, found, id, name, type, brandColor, countryId, ceo, financials, balanceSheet, shareStructure, creditRating{ rating, compositeScore, components, effectiveCouponRate }, bonds[], sectors[] }`

#### `GET /corporations`

Full list of corporation stubs.

Response: `{ ok, corporations[{ id, name, sequentialId, type, countryId }] }`

---

### Market

#### `GET /market`

| Param     | Type                 | Required             |
| --------- | -------------------- | -------------------- |
| `type`    | string (sector type) | yes                  |
| `country` | string               | no                   |
| `page`    | number               | no (default 1)       |
| `view`    | `share\|unowned`     | no (default `share`) |

#### `GET /bonds`

| Param  | Type   | Required       |
| ------ | ------ | -------------- |
| `corp` | string | no             |
| `page` | number | no (default 1) |

Response: `{ ok, found, bonds[{ id, couponRate, maturityLabel, totalIssued, marketPrice, turnsRemaining, yieldToMaturity, holders, defaulted }], pagination }`

---

### Leaderboard

#### `GET /leaderboard`

| Param     | Type                                    | Required           |
| --------- | --------------------------------------- | ------------------ |
| `country` | string                                  | no                 |
| `metric`  | `npi\|pi\|favorability\|funds\|actions` | no (default `npi`) |
| `limit`   | number (max 50)                         | no (default 10)    |

Response: `{ ok, found, metric, characters[{ rank, id, name, party, partyColor, stateCode, position, politicalInfluence, nationalInfluence, favorability, actions, funds, profileUrl }] }`

---

### News

#### `GET /news`

| Param      | Type             | Required        |
| ---------- | ---------------- | --------------- |
| `limit`    | number (max 100) | no (default 20) |
| `category` | string           | no              |

Response: `{ ok, found, posts[{ id, title, content, authorName, isSystem, category, countryId, stateId, reactions, createdAt }] }`

Full content is returned (not truncated).

---

### Game State

#### `GET /game`

Current turn, game date, and next turn time.

Response: `{ ok, found, currentTurn, gameDate, nextTurnAt, turnDurationMs }`

`gameDate` is a YYYY-MM-DD string in game time (not real time). Turn 1 = 2020-01-01; each turn = 1 game week.
