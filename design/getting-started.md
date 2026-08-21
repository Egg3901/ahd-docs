# Getting Started

Welcome to **A House Divided**, a persistent political and economic simulation. One real hour is one game turn. Elections, legislation, markets, and non-player politicians continue to move while players are offline.

## Choose a country

The character-creation screen is the authority for the countries open to new politicians in the current world. The static country registry currently marks these six as active:

| Country        | Government             | Typical national route               |
| -------------- | ---------------------- | ------------------------------------ |
| United States  | Presidential republic  | House, Senate, President             |
| United Kingdom | Parliamentary monarchy | Commons, Prime Minister              |
| Germany        | Parliamentary republic | Bundestag, Chancellor                |
| Japan          | Parliamentary monarchy | Shūgiin or Sangiin, Prime Minister   |
| Ireland        | Parliamentary republic | Dáil, Taoiseach or Uachtarán         |
| China          | One-party state        | NPC and configured executive offices |

The selected start-date preset can add historical countries and background economies to the world map. A country appearing in the world simulation does not necessarily mean that new player characters can be created there.

## First steps

1. **Create a character.** Choose a country, a valid home region, and economic and social positions from -5 to +5.
2. **Choose a party or remain independent.** Party members enter party primaries. Independents can use the independent-primary route where the configured office supports it.
3. **Build Political Influence.** Campaign in your home region and watch the cost rise as your influence tier increases.
4. **Fund the campaign.** Fundraising yield depends on donor level, state influence, the Fundraising stat, currency, and the current economy.
5. **Enter an election.** The candidate filing surface shows eligibility, timing, and whether the race uses a party or independent primary.
6. **Sustain the general-election effort.** Vote accumulation rewards activity throughout the general, with 30% of the total weight in the final four turns.
7. **Use the office.** Elected officials gain actions and National Political Influence and can access the legislation, cabinet, or executive tools attached to the office.

## Core resources

| Resource                               | What it does                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Political Influence (PI)**           | State-level reach. It grows through campaigning and decays by 0.75% each turn.                                          |
| **National Political Influence (NPI)** | National reach. It gains current PI divided by 100 each turn, plus the strongest applicable office or leadership bonus. |
| **Favorability**                       | Candidate appeal. Natural decay only applies above 60, while attacks and Infamy can pull it lower.                      |
| **Infamy**                             | Reputation risk from hostile or norm-breaking actions. It decays by 5% of its current value each turn.                  |
| **Actions**                            | The activity budget. Unused actions carry, subject to the cap and the hoarding penalty above the configured threshold.  |
| **Campaign funds**                     | Pays for campaign operations in the character's local campaign currency.                                                |
| **Cash on hand**                       | Personal liquid wealth used by investment, transfer, and conversion flows. It is separate from campaign funds.          |

## Party membership and independents

Party membership provides a primary ballot line, leadership elections, treasury tools, organization, whips, and a share of the party bonus-action pool. Independent play is a real route, not a spectator mode, but it gives up party infrastructure and follows separate election-entry rules.

Party organization is state-specific. In elections the game normalizes a party's organization against the total organization in that state and raises the share to the 0.2 exponent. Presidential primaries do not use this organization multiplier. See [Political Parties](./parties.md) and [Party Building](./party-building.md).

## A practical opening checklist

- [ ] Read the live action cards before spending. Campaign, advertising, and donor-network costs are dynamic.
- [ ] Build enough PI to be visible without spending the whole action income on upkeep.
- [ ] Fundraise early and compare the quoted local-currency yield before confirming.
- [ ] Inspect the active election's phase and candidate rules before filing.
- [ ] Use a poll to identify weak demographic groups before a large ad or canvassing push.
- [ ] Save enough actions for the final four general-election turns, which carry 30% of the race weight.

## Presidential travel

During a US presidential general election, an active candidate can travel to a state. A move costs **3, 5, 7, or 10 actions** based on that state's electoral-vote band. Remaining there adds +1 Favorability per turn and enables the travel-linked campaign surfaces. Moving again pays the new state's cost.

## Parliamentary government

In the UK, Germany, Japan, and Ireland, winning seats is not the same as forming a government. The lower chamber must seat a Prime Minister, Chancellor, or Taoiseach through the configured confidence process. If government formation remains vacant for 96 turns, the simulation can trigger a snap election. See [Parliamentary Government](./parliamentary-government.md).

## Where to go next

- [Stats & Actions](./stats-actions.md) for current formulas and dynamic costs
- [Election Mechanics](./elections.md) for primaries, general weighting, and seat allocation
- [Political Parties](./parties.md) for organization, leadership, and treasury tools
- [Bills & Legislation](./bills-legislation.md) for country-specific lawmaking
- [Corporations](./corporations.md) for plants, markets, shares, and bonds
- [World and Era Systems](./world-and-era-systems-as-shipped.md) for presets, simulation tiers, statehood, and transitions
