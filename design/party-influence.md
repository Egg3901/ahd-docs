# Party Influence

Party influence gives party leadership direct tools to manage same-party NPPs
using party resources instead of personal character actions.

## Overview

Two separate surfaces exist:

- **National party influence**
- **State / regional party influence**

Both use party actions and party treasury, but they do not have identical
scope.

## Action Set

The current influence action catalog includes:

| Action                | Actions | Base Fund Cost | Base Chance | Notes                                   |
| --------------------- | ------- | -------------- | ----------- | --------------------------------------- |
| `boost_favorability`  | `3`     | `$25,000`      | `50%`       | Public image boost                      |
| `boost_influence`     | `3`     | `$50,000`      | `45%`       | Political network boost                 |
| `boost_loyalty`       | `3`     | `$10,000`      | `55%`       | Hidden willingness / loyalty ask        |
| `reduce_stubbornness` | `3`     | `$20,000`      | `40%`       | Hidden cooperation ask                  |
| `relocate_state`      | `0`     | `$0`           | `35%`       | National-only strategic relocation tool |
| `endorse_candidate`   | `3`     | `$0`           | `40%`       | Arranged endorsement request            |
| `withdraw_election`   | `3`     | `$50,000`      | `25%`       | Ask an NPP candidate to withdraw        |
| `oppose_candidate`    | `3`     | `$25,000`      | `35%`       | Publicly oppose a candidate             |
| `support_leadership`  | `3`     | `$0`           | `45%`       | Leadership support request surface      |

## National Party Influence

National party leadership uses the broader party-management surface.

### Authorization

- `National Chair`
- `National Vice Chair`
- admin override

### Scope

National influence is meant for same-party NPP management where the national
party is the correct strategic actor.

Current intended use includes:

- endorsement requests
- withdrawal requests
- opposition requests
- broader NPP management asks
- relocation

## State / Regional Party Influence

State / regional influence is intentionally narrower and more local.

### Authorization

- `State / Regional Chair`
- `State / Regional Vice Chair`
- admin override

### Current UI Shape

The state / regional `NPPs` tab is split into:

- `Recruitment`
- `Management`

### Current Management Scope

State / regional management currently focuses on four local tools:

- `boost_favorability`
- `boost_influence`
- `boost_loyalty`
- `reduce_stubbornness`

State / regional management does not currently include local relocation.

### Target Rules

The state / regional management panel only targets NPPs who:

- are same-party
- are not retired
- have `homeState` matching that state / region scope

The panel also flags officeholders and active candidates so local leadership can
see which NPPs are already in active political use.

## Success Model

Party influence no longer follows the old "all party actions succeed" model.

### Guaranteed-ish vs Hidden-Roll Actions

- `boost_favorability` and `boost_influence` are straightforward stat-shaping
  actions
- `boost_loyalty` and `reduce_stubbornness` now behave more like hidden
  willingness asks

This keeps the local and national management systems aligned with the broader
NPP-discipline mechanics now used in Slate and whips.

### Local State / Regional Edge

State / regional leadership gets a small hidden local edge on:

- `boost_loyalty`
- `reduce_stubbornness`

That bonus is intentionally modest and only applies to the local state /
regional surface, reinforcing the value of local party leadership without
making national management obsolete.

## Endorsements

### Arranged Endorsements

`endorse_candidate` writes an arranged endorsement request into the shared
endorsement lifecycle.

It does not create a special one-off endorsement type outside the main NPP
endorsement system.

### Shared Lifecycle

Party-arranged endorsements live in the same endorsement collection as player
asks, but there is no longer an organic NPP endorsement source creating new
campaign support on its own.

- the endorsement is public
- the internal scoring remains hidden
- the endorsement lasts only while that specific campaign remains active and
  plausible

That means party-arranged endorsements are still part of the real NPP
endorsement lifecycle rather than a permanently frozen override, but they are
no longer competing with an organic endorsement pass.

## Withdrawals

`withdraw_election` remains a direct party lever for clearing a same-party NPP
out of a race when leadership wants a different candidate path.

This interacts with Slate and election-entry behavior:

- an NPP can later re-enter where rules allow
- Slate reassignment can redirect same-state NPP behavior after a withdrawal

## Audit Trail

Party influence attempts are written to `nppInfluenceAttempts`, and downstream
effects are visible through party pages, analytics, and endorsement surfaces.

## Related Docs

- [npp-system.md](./npp-system.md)
- [parties.md](./parties.md)
- [party-building.md](./party-building.md)
- [party-slate.md](./party-slate.md)
