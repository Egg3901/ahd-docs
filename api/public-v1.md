# A House Divided — Public API v1

Base URL: `https://ahousedividedgame.com/api/public/v1`

## Authentication

All endpoints accept either a user API key or the deployment bot token:

```http
X-API-Key: <your-user-api-key>

# or
X-Bot-Token: <your-key>
```

User keys can have public or private scope. The legacy bot-token path uses the server's `PUBLIC_BOT_API_KEY` and is normally issued by an administrator.

## Rate limiting

The default read limit is 60 requests per minute for each endpoint bucket and credential owner. User keys are bucketed by user; the shared bot token is bucketed by route family. Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and reset metadata. On limit, the API returns HTTP 429 with `Retry-After`.

Successful public responses are edge-cacheable for 30 seconds with a 60-second stale-while-revalidate window. Do not assume two requests inside that window represent different turns.

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

#### `GET /character/:id`

Fetch one character by ObjectId or supported public character identifier.

Response: the same enriched public character fields returned by `GET /character`, wrapped with `{ ok, found }`.

#### `GET /characterSearch`

Compatibility alias for `GET /character`. It accepts the same `name` or `discordId` query parameter and uses the same rate-limit bucket.

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

Central bank data and macro indicators. Each history array contains the latest 12 recorded observations. The sampling cadence is defined by the producer, so clients should not label this as a full game year without inspecting the returned turn values.

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

#### `GET /commodities`

Returns every configured commodity. An optional `country=CODE` query adds national price, supply, and demand fields.

Response: `{ ok, commodities[{ key, label, unit, basePrice, globalPrice, globalSupply, globalDemand, nationalPrice?, nationalSupply?, nationalDemand?, turn }] }`

#### `GET /commodity/:key`

Returns one commodity with state-level price, supply, and demand maps plus the top ten producing and consuming states. The optional `country=CODE` query filters state data and adds national totals.

Response: `{ ok, found, commodity{ key, label, unit, basePrice, globalPrice, globalSupply, globalDemand, statePrices, stateSupply, stateDemand, topProducers, topConsumers, turn } }`

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
