# China (CN) — System Design

## Overview

China is modelled as a one-party parliamentary state. The Chinese Communist
Party (CPC) dominates government formation, bill passage, and executive
appointment. Other parties (CDL, CNDCA) participate in the CPPCC advisory body
and can hold NPC seats but are gated from forming governments or fielding
premier candidates.

## Legislature

**National People's Congress (NPC)**: 2,980 seats, the sole elected chamber.
Organised across 7 geographic macro-regions. Uses FPTP for nominal seat
allocation; indirect election reflects real-world provincial delegation.

**CPPCC** (2,169 seats): advisory body only. Not elected. Not part of the
player legislative loop. Seats are seeded per-region but have no turn-engine
mechanics.

## Executive

**Premier** (head of government): appointed via parliamentary confidence vote,
gated by one-party constraints so only CPC can form a government or field a
candidate.

## One-Party Constraints

File: `src/lib/turn/onePartyConstraints.ts`

| Operation                             | Gate                  |
| ------------------------------------- | --------------------- |
| Form government                       | CPC only              |
| Field premier candidate               | CPC only              |
| Trigger VONC                          | CPC only (self-check) |
| Invite to coalition                   | CPC only              |
| Government collapse on coalition loss | Disabled              |

`confidenceVoteMechanism: false` in `CountryConfig` reflects that non-CPC
parties cannot initiate confidence votes. Runtime gates in
`onePartyConstraints.ts` enforce ruling-party-only (= CPC for CN) access.

## CPC Confidence Model

Files: `src/lib/turn/rulingPartyPriorities.ts`, `src/lib/turn/rulingPartyConfidenceTurn.ts`

The subsystem is country-agnostic — the priority profile and policy-axis
effects map for CN live on `COUNTRY_CONFIGS.CN.priorityProfile` and
`COUNTRY_CONFIGS.CN.policyAxisEffects`. See
[`docs/design/ruling-party-confidence.md`](./ruling-party-confidence.md)
for the generic design; this section describes CN's specific profile.

Each turn, enacted bills are scored against the CPC's 9-axis priority profile
(party control, social stability, state-sector strength, industrial policy,
economic growth, national security, regional balance, market openness,
anti-corruption). The score drives leader confidence drift.

## Regional Budget

File: `src/lib/turn/cnRegionalBudget.ts`

**Revenue sources per region:**

1. **EIT local share** (企业所得税地方分成): 40% of Enterprise Income Tax
   collected in-territory. Derived from enacted `cn_enterprise_income_tax` rate
   × regional GDP × 6% corporate profit ratio. Defaults to 25% EIT if not
   enacted.

2. **Central transfer grant** (中央转移支付): Finance Minister
   (`CN_minister_of_finance` cabinet setting) sets allocation percentages.
   Defaults to an equal 1/7th split of a ¥4,000/person national pool (~¥5T total).

**Austerity**: Regions in deficit for more than one turn have their most
expensive programme downgraded one tier, matching UK and JP behaviour.

**Provincial spending bills**: The provincial-scope §29 legislation
(`cn_provincial_education`, `cn_provincial_public_security`,
`cn_provincial_economic_development`, `cn_provincial_health_services`,
`cn_provincial_culture_propaganda`, `cn_provincial_environmental_policy`,
`cn_provincial_infrastructure_investment`) all carry `annualCostPerCapita`
on their policy options, so each region's enacted spending is summed
against revenue to drive the austerity check. Regions default to the
statutory baseline (center option) on seed; provincial People's Congress
legislation moves them.

## Regions

7 macro-regions replace 31 provincial-level divisions for gameplay:
NORTHEAST, NORTH, EAST, CENTRAL, SOUTH, SOUTHWEST, NORTHWEST.

Total NPC seats: 2,980. Total CPPCC seats: 2,169.

## Elections

One `npcDelegate` election per region, 5-year terms, FPTP. No snap elections.
No upper-chamber elections (CPPCC is advisory).
