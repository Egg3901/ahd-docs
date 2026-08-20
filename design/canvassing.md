# Canvassing

Canvassing is a player action that directly boosts voter turnout for a specific demographic group in the character's active campaign state - typically the home state, but `travelState` or `primaryCampaignState` for active presidential candidates. Unlike ads (which raise favorability) or party GOTV spending (which is passive and automatic), canvassing is an active, targeted intervention that modifies how many voters from a chosen group show up on election day.

## Mechanic

### Cost

- **100 funds** and **1 action point** per use.
- Deducted immediately when the action is submitted.

### Targeting

The player selects a demographic group from two levels:

1. **Category** - one of five Layer 1 categories: `race`, `age`, `education`, `wealth`, `ideology`.
2. **Group** - a specific group within that category (21 groups total):

| Category  | Groups                                                                            |
| --------- | --------------------------------------------------------------------------------- |
| Race      | White, Black, Hispanic, Asian, Other                                              |
| Age       | Young (18-29), Middle-Aged (30-49), Mature (50-64), Senior (65+)                  |
| Education | No College, College Educated, Graduate Degree                                     |
| Wealth    | Low Income, Middle Income, High Income                                            |
| Ideology  | Evangelicals, Environmentalists, Libertarians, Progressives, Patriots, Gun Owners |

Canvassing targets a single state at a time. The target is determined server-side from the character's active candidacy:

| Character state                                                 | Canvass target              |
| --------------------------------------------------------------- | --------------------------- |
| Active presidential candidate, primary phase, primary state set | `primaryCampaignState`      |
| Active presidential candidate, primary phase, no primary state  | none - UI disabled, API 403 |
| Active presidential candidate, general phase, travel state set  | `travelState`               |
| Active presidential candidate, general phase, no travel state   | none - UI disabled, API 403 |
| Any other character                                             | `homeState`                 |

An active presidential candidacy "captures" the canvass target - even at home, a presidential candidate must `travelState` home to canvass there. This keeps canvassing aligned with the rest of the presidential travel system. Attempting to canvass in any other state returns a 403 error.

### Effectiveness Formula

```
baseBoost         = 0.05 (percentage points)
distance          = |charEcon − demoEcon| + |charSocial − demoSocial|
alignmentMult     = max(0.1, 1.0 − distance × 0.15)
seasonMult        = isActiveCampaignSeason ? 2.0 : 1.0
rawBoost          = baseBoost × alignmentMult × seasonMult
adjustedBoost     = rawBoost × (1 − |currentModifier| / 20)   // diminishing returns
newModifier       = clamp(currentModifier + adjustedBoost, −20, 20)
```

**Alignment** is based on Manhattan distance between the character's `policies.economic` / `policies.social` positions and the demographic's lean values (−5 to +5 on each axis):

| Distance | Alignment multiplier |
| -------- | -------------------- |
| 0        | 1.0×                 |
| 3        | 0.55×                |
| 6+       | 0.1× (floor)         |

**Campaign season multiplier**: When an election in the state has status `active` and its `endTime` falls within the next 4 turns (4 real hours), the multiplier doubles to **2.0×**. Outside campaign season the multiplier is 1.0×.

**Diminishing returns**: As the existing modifier approaches its ±20 cap, each additional boost delivers less. At a current modifier of +10, a 1 pp raw boost lands as 0.5 pp effective. At ±20 the boost reaches zero.

### Timing

Canvassing takes effect **immediately** upon the API call - the modifier is written to the database in the same request, not queued for turn processing. The `lastUpdated` timestamp on the `StateDemographicTurnout` document is updated at the same time.

## Integration with Demographics

### Modifier Decay

All turnout modifiers, including those set by canvassing, decay **2% per turn** toward zero. This means a single canvass action does not persist indefinitely; sustained canvassing is required to maintain a boost into election day.

### How Modifiers Affect Election Turnout

Canvassing modifies `stateDemographicTurnout.modifiers[category][group]` for the target state. During election resolution, `deriveGroupTurnout` (in `src/lib/seeds/stateDemographics.ts`) applies these Layer 1 modifiers to the 12 voter archetypes:

1. Each voter archetype is composed of Layer 1 demographics with weighted contributions.
2. For each Layer 1 demographic in the archetype's composition, the state modifier is fetched and multiplied by that weight.
3. The sum of weighted modifiers is added to the archetype's baseline turnout.

**Example**: Young Renters (baseline 38% turnout) are heavily composed of the `young` age group. If a player has canvassed young voters in their state and raised the `age.young` modifier to +5, Young Renters' effective turnout in that state rises toward 43%.

### Interaction with Party GOTV

Party GOTV spending and player canvassing both write to the same `modifiers` fields in `stateDemographicTurnout`. They stack additively (both are subject to the ±20 cap and diminishing returns independently). Turn processing order:

1. **Decay** applied to all modifiers.
2. **Party GOTV** boosts applied (passive, budget-driven).
3. Canvassing effects are applied at request time (immediate), not during turn processing.

## Database

### Collection: `stateDemographicTurnout`

One document per state/region. Canvassing reads and writes this document.

| Field                        | Type     | Notes                                         |
| ---------------------------- | -------- | --------------------------------------------- |
| `_id`                        | `string` | State ID (e.g. `"PA"`)                        |
| `modifiers[category][group]` | `number` | −20 to +20; the field canvassing updates      |
| `lastUpdated`                | `Date`   | Set to `new Date()` on every canvassing write |
| `lastDecayApplied`           | `Date`   | Set by turn decay, not by canvassing          |

The update is a targeted `$set` on `modifiers.${category}.${group}` - only the chosen group's modifier is touched.

### Collection: `characters`

Canvassing deducts cost from the acting character via `$inc`:

| Field     | Change |
| --------- | ------ |
| `funds`   | −100   |
| `actions` | −1     |

### Collection: `elections`

Two read-only queries at request time:

1. **Eligibility resolution** - for active presidential candidates, joins `electionCandidates` to `elections` filtered by `electionType: "president"`, `status: "active"` to determine the candidate's canvass target state (travel or primary campaign).
2. **Campaign season check** - queries for an election where `state` matches the canvass target, `status === "active"`, and `endTime` is within the next 4 hours, to apply the 2× campaign-season multiplier.

### Collection: `electionCandidates`

Read-only at request time. Eligibility resolution looks up the authenticated character's active candidacies (`status: "active"`) to detect presidential candidacy and read `travelState` / `primaryCampaignState`.

## Strategy Notes

- **Canvass demographics you're aligned with.** At maximum misalignment the effective boost is only 0.1× of base, making it nearly wasted spend. At perfect alignment you get the full 0.05 pp (or 0.10 pp in campaign season).
- **Time it for campaign season.** The 2× season multiplier makes the 4 turns before an election the highest-value window. A well-timed burst of canvassing outperforms the same actions spread over earlier turns.
- **Canvassing vs. ads.** Canvassing raises turnout for a demographic; ads raise your favorability with that demographic. Turnout boosts help you only if the boosted group leans toward you. On demographics that lean away from you, ads to improve favorability may be more efficient than canvassing.
- **Stack with party GOTV.** If your party is already running GOTV budget on aligned demographics, the state modifier may already be elevated. Diminishing returns apply - check the current modifier before canvassing to gauge how much headroom remains before hitting the cap.
- **Decay planning.** A +5 modifier decays to roughly +3.6 after three turns (2% per turn of the current value). For an election 4 turns out, start canvassing 2-3 turns ahead rather than immediately.

## Related Documentation

- [Demographics](./demographics.md) - Turnout system, modifier decay, GOTV mechanics, `deriveGroupTurnout`
- [Campaign Strategy](./campaign-strategy.md) - Overall campaign planning
- [Fundraising & Ads](./fundraising-ads.md) - Alternative fund expenditures
- [Stats & Actions](./stats-actions.md) - Action point costs and refresh
