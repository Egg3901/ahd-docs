# Campaign Manager System

The Campaign Manager is scoped to **US presidential races only** (more precisely: `electionType === "president"` AND the country's `executiveFormation === "direct_election"`). Senate, house, governor, UK commons, JP shugiin / sangiin, and other parliamentary races run candidates, endorsements, and vote tallies without a Campaign doc.

When a candidate enters a US presidential race (primary or general), `POST /api/elections/[id]/enter` calls `createInitialCampaign` — gated by `isCampaignEligibleElection`. The same gate is enforced in admin routes (`start-general`, `place-candidate`) so a future non-direct-election "president" office (e.g. parliament-appointed figurehead) will not spawn a Campaign Manager pool.

Each eligible candidacy has an associated campaign with a dedicated page at `/campaign/[id]`. The page adapts based on who is viewing it.

## Access Tiers

| Viewer                   | Access Level    | What They See                                                   |
| ------------------------ | --------------- | --------------------------------------------------------------- |
| **Campaign owner**       | Full management | All tabs: overview, upgrades, donations, activity log, settings |
| **Same-party member**    | Intelligence    | Basic candidate info, endorsement count, public upgrade levels  |
| **Public / other party** | Summary         | Candidate name, party, office sought, public stats only         |

This creates a "fog of war" mechanic: players cannot see the full details of opponents' campaigns.

## Campaign Resources

Each campaign has two independent resource pools:

- **Campaign Funds** — Earned from fundraising income per turn, player donations, and party donations. Spent on upgrades.
- **Campaign Actions** — Generated per turn from endorsements (`1 + floor(sqrt(endorsements) × 3)`, minimum 1). Spent on upgrades.

These are entirely separate from the candidate's personal funds and character actions.

## Strategic Upgrades

Campaigns have four upgradeable dimensions:

| Category                | Max Level | Primary Effect                                  |
| ----------------------- | --------- | ----------------------------------------------- |
| **Fundraising**         | 10        | Passive income: $20k/turn (L0) → $5M/turn (L10) |
| **Media Spending**      | 5         | +0.5% candidate favorability per level per turn |
| **Ground Game**         | 5         | +3% swing-state turnout boost per level         |
| **Opposition Research** | 5         | −0.5% target favorability per level per turn    |

Upgrade costs are **1.5× higher** once the election enters the general phase (`primaryEndTime ≤ now < endTime`).

## Opposition Research

Purchasing opposition research requires selecting a target. The target's favorability drains passively each turn based on your level.

- **Retargeting** — Change your target at any time via the campaign page. A **6-hour cooldown** (`oppositionResearchCooldownUntil`) applies between retargets.
- `POST /api/campaigns/[id]/retarget` — Owner or manager only; requires `oppositionResearchLevel > 0`.

## Campaign Season Multiplier

In the final 4 turns before `election.endTime`, all passive effects from media spending and opposition research are automatically doubled (2×). No player action required.

## Donations

Any authenticated player can donate personal Cash on Hand to any active campaign (minimum $1). The national party chair can donate from the party treasury.

- **Donation log** — All donations are recorded in `campaign.donationLog` (last 100 entries). Fields: donor name, donor type (`"character"` | `"party"`), amount, turn number.
- `POST /api/campaigns/[id]/donate` — Body: `{ amount: number, partyId?: string }`. Omit `partyId` for personal donation; include it for a party donation (chair authorization required).

## Manager Assignment

An admin can assign a campaign manager character to any campaign:

- **API**: `POST /api/admin/campaigns/[id]/assign-manager`
- **Effect**: The assigned character gains limited management access to the campaign
- **Use case**: Party leadership delegating campaign oversight

## Endorsements

NPP endorsements are now **manual-only**. They come from explicit asks in the
player-to-NPP interaction panel rather than organic turn-time re-evaluation.
The endorsement check stays hidden from players, but the panel shows a
`Likely to Accept` / `Likely to Decline` chip based on current relationship and
policy fit. For **presidential elections**, player endorsements also count
toward the campaign actions formula. For all other race types, player
endorsements are cosmetic only.

Active NPP endorsements now matter in two ways:

- they continue to feed campaign action generation
- they also add a small capped direct favorability boost in race calculations so endorsements are not purely an action-economy stat

| Viewer | Endorsement visibility          |
| ------ | ------------------------------- |
| Owner  | Full list with influence levels |
| Party  | Count only                      |
| Public | Not shown                       |

## Database Collections

| Collection  | Purpose                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| `campaigns` | Campaign state: candidate reference, manager assignment, resource pools, upgrade levels, donation log, fog-of-war snapshots |

### Key `Campaign` Fields

| Field                             | Type                 | Purpose                            |
| --------------------------------- | -------------------- | ---------------------------------- |
| `funds`                           | `number`             | Current campaign fund balance      |
| `actions`                         | `number`             | Current campaign action balance    |
| `fundraisingLevel`                | `number` (0–10)      | Fundraising upgrade level          |
| `mediaSpendingLevel`              | `number` (0–5)       | Media spending upgrade level       |
| `groundGameLevel`                 | `number` (0–5)       | Ground game upgrade level          |
| `oppositionResearchLevel`         | `number` (0–5)       | Opposition research upgrade level  |
| `oppositionTargetId`              | `ObjectId \| null`   | Current opposition research target |
| `oppositionResearchCooldownUntil` | `Date \| null`       | Cooldown expiry for retargeting    |
| `donationLog`                     | `CampaignDonation[]` | Last 100 donation entries          |
| `publicFogOfWar`                  | `CampaignFogOfWar`   | Public-visible upgrade snapshot    |
| `partyFogOfWar`                   | `CampaignFogOfWar`   | Party-visible upgrade snapshot     |

## API Routes

| Route                                      | Method | Access        | Purpose                                          |
| ------------------------------------------ | ------ | ------------- | ------------------------------------------------ |
| `/api/campaigns/[id]`                      | GET    | Tiered        | Campaign detail (access level shapes response)   |
| `/api/campaigns/mine`                      | GET    | Authenticated | Current user's active campaign                   |
| `/api/campaigns/[id]/upgrade`              | POST   | Owner/Manager | Purchase an upgrade (1.5× cost in general phase) |
| `/api/campaigns/[id]/donate`               | POST   | Authenticated | Donate funds (personal or party treasury)        |
| `/api/campaigns/[id]/retarget`             | POST   | Owner/Manager | Change opposition research target (6h cooldown)  |
| `/api/admin/campaigns/[id]/assign-manager` | POST   | Admin         | Assign a manager character to a campaign         |

## Related Documentation

- [Elections](./elections.md) — Elections Hub and candidacy rules
- [Campaign Strategy](./campaign-strategy.md) — Action allocation and win strategies
- [Stats & Actions](./stats-actions.md) — Action costs and campaign activities
- [NPP System](./npp-system.md) — Endorsement mechanics
