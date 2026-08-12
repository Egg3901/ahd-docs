# Player Policies

Your character has personal **economic** and **social** policy positions on a −5 to +5 scale. These are separate from the **legislative status quo** tracked for each policy area in government (see [[Bills & Legislation]]).

## Personal positions

- **Economic axis** — Left (negative) to right (positive) on fiscal and regulatory questions.
- **Social axis** — Progressive (negative) to conservative (positive) on cultural and rights questions.

You set starting positions at **character creation**. They matter for **election appeal**: candidates closer to a demographic group's lean tend to earn higher appeal with that group during vote calculation (see [[Election Mechanics]] and [[Demographics & Targeting]]).

## Changing your positions — policy shift

Use the **policy shift** action from settings (API: `POST /api/settings/policy`):

| Resource            | Cost               |
| ------------------- | ------------------ |
| Actions             | 15                 |
| Political influence | −5% (floored at 0) |
| National influence  | −5% (floored at 0) |
| Infamy              | +5                 |

Each request moves **one axis** by one step (`direction` ±1). Values clamp to **−5…+5**; out-of-range requests are rejected.

## Bills and voting

Voting on bills **does not** automatically move your personal policy coordinates. Bills still change **state/national** `statePolicies` records and metrics when enacted; your character's private `(economic, social)` profile is independent unless you shift it manually.

## Viewing the policy landscape

The **Policy** page (`/policy`) shows current **government** positions by legislation type — national or per-state — with human-readable option names. Use it to see the law as it stands, compare to your personal stance, and plan legislation or campaigns.

## Related pages

- [[Bills & Legislation]] — Provisions, votes, archetype approval impacts
- [[Election Mechanics]] — How appeal and vote share work
- [[Demographics & Targeting]] — Groups, leans, and turnout
- [[Stats & Actions]] — Action economy and costs
- [[National Metrics]] — Outcomes from enacted policy over time
