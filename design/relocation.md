# Relocation

Players can change their character's **home state** (or UK region, JP prefecture). Home state controls where you run for most offices, canvass, and most eligibility checks.

## Cooldown

- **72 turns** (72 game-hours, 3 real days) from your last successful relocation before you can move again. See `RELOCATION_COOLDOWN_TURNS` in `src/lib/character/relocationCooldown.ts`.

## What always resets (any relocation)

- **Political influence** → 0
- **Donor base** → 0
- **Group favorability** → cleared
- **State/region-party leadership** (chair, vice-chair, treasurer) in the state you left → vacated
- **Any active candidacy** (general/primary, state-party, national-party, committee) → withdrawn
- **Current office** → auto-resigned; the seat is vacated in `electedOfficials`
- **CEO of a corporation** → removed; corp enters CEO vacancy. Exception: National Corporation CEOs keep the seat on a same-country move; a cross-country move still unseats (see CEO and corporation rules below).
- **Career history** → a `"relocated"` entry is appended with `fromState` / `toState` (and `fromCountry` / `toCountry` if the country changed)

## What only resets on country change

- **National influence** → 0
- **Party influence** → 0
- **Party membership** → set to Independent
- **National party leadership positions** (chair, vice-chair, treasurer) → vacated; party `memberCount` decrements
- **National committee membership** → cleared
- **Coalition chair** (if your party leads one) → cleared
- **Central-bank chair** → auto-resigned
- **Campaign manager role** (any campaign you manage) → cleared
- **Caucus participation** → membership closed, chair/vice-chair seats cleared, chair candidacies withdrawn
- **Prime Minister title** (`governmentFormations` and `parliamentaryGovernments`) → cleared
- **Cabinet membership** → removed from `cabinetMembers`

These cross-country cleanup steps run in `src/lib/character/performRelocation.ts` (step 4b).

## What is preserved

Campaign funds, personal cash, savings (all currencies), actions, favorability, infamy, policy positions, earlier career history entries, avatars, bonds, share holdings, and line-of-credit balances/arrears.

## Blocking conditions

- Target state must exist and differ from your current home state.
- 72-turn (3-day) cooldown since your last relocation.
- Destination country must be enabled for players (admins bypass this check).
- If the destination is US, the target must be an admitted political state, not an unplayable territory.

There is **no** block for active candidacies or office-holding: those are handled automatically.

## CEO and corporation rules

- By default, any relocation removes you as CEO if you hold the role; the corporation enters CEO vacancy.
- Exception: National Corporation CEOs have relaxed country-level residency. A same-country relocation does not unseat them; a cross-country move still does. See `src/lib/character/performRelocation.ts` step 3.
- To accept a CEO role, your home state must match the corporation's headquarters state. See [[Corporations]].

## Combined character + corporation relocation

When you click "Relocate here" from a region page as a CEO, the dialog offers three options instead of the usual two:

- **Cancel**: dismiss, no action.
- **Relocate & Abandon Corporation**: standard character relocation; CEO role is auto-vacated as always.
- **Relocate & Move Corporation**: character and corporation HQ move in a single transaction via `POST /api/character/relocate-with-corp`. You remain CEO.

Cross-country corporate relocations cost **2× the base 7% of market cap** (so 14%). Imperial CEOs' corporations move along with the character at no cost: they receive the standard 2-button dialog with an info line rather than the chooser.

The "Relocate & Move Corporation" button is disabled when the corp cannot afford the selected payment method (insufficient Liquid Capital, bond cooldown still active, or leverage cap reached). The other two options remain available.

When a HQ moves via the CEO Office (not the combined flow) and the CEO does not reside at the destination, the CEO is auto-vacated: same semantics as character relocation. The UI warns the player before submission; the action is not blocked.

## Strategy notes

- Time relocation around election filing and canvassing: both are home-state scoped.
- Cross-country moves are heavy: expect to lose your party, all national influence, and any national-level positions.

## Admin and moderator overrides

`PATCH /api/admin/characters/update-country`, `PATCH /api/admin/characters/update-state`, `PATCH /api/moderator/characters/update-country`, and `PATCH /api/moderator/characters/update-state` run the full pipeline above: they never bypass cleanup. The only difference from the player flow is that cooldowns, country-availability gates, and rate limits are skipped.

## Related pages

- [[Getting Started]]: Creating a character and first steps
- [[Corporations]]: Founding, HQ, CEO eligibility
- [[State-Level Power]]: Governor and state offices
- [[United Kingdom]]: UK regions as home "state"
