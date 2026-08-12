# Government Approval System

## Overview

Each state and the nation has a **government approval** rating (0–100%). Base 50%. State and national metrics (economic, education, healthcare, etc.) affect approval positively when above average and negatively when below average. Named **approval modifiers** (Democracy 3-style) then add or subtract a fixed amount when specific metric thresholds are simultaneously met — they stack freely.

## Formula

### State Approval

1. **Base**: 50%
2. **Per metric**: Compare state value to national (population-weighted) average
   - **Higher-is-better** metrics (median income, graduation rate, etc.): state > avg → bonus, state < avg → penalty
   - **Lower-is-better** metrics (unemployment, crime, infant mortality, etc.): state < avg → bonus, state > avg → penalty
3. **Contribution**: `(value - avg) / avg` (or flipped for lower-is-better), scaled by 15 and clamped to ±2 per metric
4. **Subtotal**: `50 + (sum of contributions / count) × 2.5`, clamped to 0–100
5. **Modifiers**: Named conditions (see below) are evaluated; each active modifier adds its `effect` to the subtotal. Clamped to 0–100.

### National Approval

- The **country's population-weighted metric averages** are compared against the **global average** (all countries combined), using the same relative math as state approval.
- This avoids the structural ~50% result that would come from averaging relative state scores.
- Modifiers are evaluated against the national average metrics.

## Approval Modifiers

Named conditions that fire when **all** their metric thresholds are met simultaneously. Multiple modifiers stack (their effects sum). Labels describe the **metric state**, not a political judgment. Single-condition modifiers fire more easily; multi-condition ones carry stronger effects. Maximum effect per modifier is ±4. High immigration (migrationRate) is modelled as a net negative. Thresholds are calibrated so both US and UK realistic national averages trigger meaningful conditions.

### Positive Modifiers

| Modifier                     | Effect | Conditions                                                |
| ---------------------------- | ------ | --------------------------------------------------------- |
| Economic Boom                | +3     | GDP growth ≥ 3.0%, unemployment ≤ 4.5%                    |
| Low Unemployment             | +2     | Unemployment ≤ 3.5%                                       |
| Low Poverty Rate             | +2     | Poverty rate ≤ 8%                                         |
| Affordable Cost of Living    | +2     | Cost of living ≤ 90                                       |
| Strong Economic Growth       | +2     | GDP growth ≥ 2.5%                                         |
| Healthcare Excellence        | +3     | Life expectancy ≥ 83, affordability index ≥ 78            |
| Universal Healthcare Access  | +3     | Uninsured ≤ 5%, physician rate ≥ 2.5                      |
| High Life Expectancy         | +2     | Life expectancy ≥ 82                                      |
| Low Crime Rate               | +3     | Crime rate ≤ 2800, safety confidence ≥ 70                 |
| Falling Crime                | +2     | Crime rate ≤ 3500                                         |
| Low Reoffending Rate         | +2     | Recidivism rate ≤ 30%                                     |
| Clean Environment            | +3     | Renewable energy ≥ 50%, air quality ≤ 25                  |
| Green Energy Transition      | +2     | Renewable energy ≥ 30%                                    |
| Strong Recycling Culture     | +2     | Recycling rate ≥ 45%                                      |
| High Government Transparency | +3     | Gov transparency ≥ 78, public trust ≥ 62                  |
| High Public Trust            | +2     | Public trust ≥ 68                                         |
| High Voter Turnout           | +2     | Voter turnout ≥ 72%                                       |
| Balanced Budget              | +2     | Budget balance ≥ 0                                        |
| Skilled Workforce            | +2     | HS grad rate ≥ 88%, workforce skill ≥ 68                  |
| Education Excellence         | +3     | HS grad ≥ 92%, test performance ≥ 115, literacy ≥ 97%     |
| Strong Social Cohesion       | +2     | Social cohesion ≥ 68, civic participation ≥ 62            |
| Strong Safety Net            | +3     | Food insecurity ≤ 7%, homelessness ≤ 8                    |
| High Social Mobility         | +2     | Social mobility ≥ 68                                      |
| Modern Infrastructure        | +3     | Road condition ≥ 80, broadband ≥ 90%, water quality ≥ 95% |
| High Broadband Access        | +2     | Broadband access ≥ 90%                                    |
| Clean Water Supply           | +2     | Water quality ≥ 96%                                       |
| High Civic Participation     | +2     | Voter turnout ≥ 75%, civic participation ≥ 68             |
| Innovation Economy           | +3     | Small business formation ≥ 6, workforce skill ≥ 75        |
| Free Press                   | +2     | Press freedom ≥ 75                                        |
| High News Trust              | +2     | News trust ≥ 60, media polarization ≤ 30                  |
| Healthy Longevity            | +2     | Life expectancy ≥ 82, preventable mortality ≤ 200         |

### Negative Modifiers

| Modifier                   | Effect | Conditions                                                |
| -------------------------- | ------ | --------------------------------------------------------- |
| Recession                  | −4     | GDP growth ≤ 0%, unemployment ≥ 7%                        |
| High Unemployment          | −2     | Unemployment ≥ 8%                                         |
| Stagnant Economy           | −1     | GDP growth ≤ 1.0%                                         |
| Cost of Living Crisis      | −3     | Cost of living ≥ 140, poverty rate ≥ 17%                  |
| High Poverty Rate          | −2     | Poverty rate ≥ 15%                                        |
| High Immigration Pressure  | −2     | Migration rate ≥ 0.4                                      |
| Aging Population           | −1     | Median age ≥ 40                                           |
| Population Decline         | −2     | Population growth ≤ 0%, migration rate ≤ 0                |
| Healthcare System Strain   | −3     | Affordability index ≤ 48, preventable mortality ≥ 350     |
| Low Life Expectancy        | −3     | Life expectancy ≤ 78                                      |
| High Preventable Mortality | −2     | Preventable mortality ≥ 270                               |
| Weak Healthcare Capacity   | −2     | Physician rate ≤ 2.2, affordability index ≤ 65            |
| High Crime Rate            | −3     | Crime rate ≥ 5000, violent crime rate ≥ 280               |
| High Violent Crime         | −2     | Violent crime rate ≥ 380                                  |
| High Incarceration Rate    | −2     | Incarceration rate ≥ 500, recidivism ≥ 55%                |
| Environmental Degradation  | −3     | Air quality ≥ 45, carbon emissions ≥ 17                   |
| Poor Air Quality           | −1     | Air quality ≥ 35                                          |
| High Carbon Footprint      | −1     | Carbon emissions ≥ 13                                     |
| High Corruption            | −4     | Corruption index ≥ 45, public trust ≤ 38                  |
| Corruption Concerns        | −2     | Corruption index ≥ 35                                     |
| Low Public Trust           | −2     | Public trust ≤ 45                                         |
| Government Deficit         | −1     | Budget balance ≤ −1.5%                                    |
| Fiscal Crisis              | −3     | Budget balance ≤ −4.0%                                    |
| Extreme Income Inequality  | −3     | Income inequality ≥ 0.42, homelessness ≥ 20               |
| Rising Inequality          | −1     | Income inequality ≥ 0.36                                  |
| High Homelessness          | −2     | Homelessness rate ≥ 18                                    |
| Social Fragmentation       | −3     | Food insecurity ≥ 15%, social cohesion ≤ 48               |
| Food Insecurity            | −1     | Food insecurity ≥ 12%                                     |
| Low Social Mobility        | −2     | Social mobility ≤ 42                                      |
| Skills Gap                 | −2     | Workforce skill ≤ 45, unemployment ≥ 7%                   |
| Crumbling Infrastructure   | −3     | Road condition ≤ 55, water quality ≤ 78%, broadband ≤ 65% |
| Poor Broadband Access      | −2     | Broadband access ≤ 68%                                    |
| Disinformation Spread      | −3     | Media polarization ≥ 60, disinformation risk ≥ 55         |
| Polarized Media            | −1     | Media polarization ≥ 40                                   |
| Restricted Press Freedom   | −3     | Press freedom ≤ 40, disinformation risk ≥ 50              |
| Negative Net Migration     | −2     | Migration rate ≤ −1, population growth ≤ 0%               |
| Unaffordable Housing       | −3     | Homelessness ≥ 25, cost of living ≥ 125                   |

## Display

- **State page**: Government Approval in the stats strip. Hover to see active modifiers.
- **Country overview page**: Government Approval in the leadership stats strip. Hover to see active modifiers.
- **National metrics page**: Government Approval in the header. Hover to see active modifiers.
- Color coding: green ≥ 50%, amber 40–50%, red < 40%
- Tooltip shows each active modifier with its label and effect, and the net sum.

## Data Source

- Computed on-the-fly from `stateMetrics` and national averages
- No persistent storage; recalculated each request
- APIs: `GET /api/state/[id]/metrics` and `/api/national/metrics` return `governmentApproval` and per-state `modifiers`

## UK Government Transitions and Cabinet Dismissal

Government approval is not directly involved in UK government transitions, but these events are worth noting in context:

When the UK government changes hands — either because a no-confidence vote passes and the PM is removed, or because a new UK government is formed after a general election — **the entire UK cabinet is automatically dismissed** via `clearCabinetOnTransition`. All serving ministers lose their cabinet positions and revert to ordinary MP status. This is handled in `src/lib/turn/ukGovernment.ts` (no-confidence path) and `src/lib/turn/ukGovernmentFormation.ts` (post-election formation path).

This is not an approval change, but it is a government-level disruption that can indirectly affect approval over subsequent turns as new policies take effect under the incoming government.

See [uk-pm-no-confidence.md](./uk-pm-no-confidence.md) for the full mechanics of the no-confidence process.

## No-Confidence Votes and Approval

Government approval does **not** influence the outcome of a no-confidence vote. NPP MPs vote on no-confidence motions based solely on their **favorability toward the PM** (a per-character attribute), not the government approval score:

- PM favorability ≥ 60: 90% of NPP MPs vote to retain the PM
- PM favorability 40–59: 50% of NPP MPs vote to retain the PM
- PM favorability < 40: 90% of NPP MPs vote to remove the PM

Similarly, NPP voting in post-election confidence votes (PM selection) is driven by **party alignment**, not approval.

Government approval and PM favorability are independent values; a high national approval score gives no protection against a no-confidence motion. Players who want to survive a challenge need to maintain good favorability within their own parliamentary party, not just strong headline approval numbers.

## Use in Elections

State government approval is used in the **party strength** modifier during general-election vote accumulation. Each turn, the vote pool for an election is scaled by:

- **Formula**: `(1 + approval/100) × officeStrength`
- **Office strength** by race type: Governor 1.0, House 0.9, Senate 0.8, State Senate 0.85

So in high-approval states, more votes are allocated per turn; governor races get the full effect, House and Senate are scaled down. When state metrics are missing, approval is treated as 50%. See [[Election Mechanics]] for the full appeal and vote-accumulation pipeline.

## Implementation

- `src/lib/utils/governmentApproval.ts` — `calculateStateApproval()`, `calculateApprovalFromAverages()`, `computeNationalAveragesFromMetrics()`
- `src/lib/utils/approvalModifiers.ts` — `MODIFIER_DEFS` (68 named conditions), `evaluateModifiers()`, `applyModifiers()`
- `src/components/ApprovalTooltip.tsx` — hover tooltip listing active modifiers; uses a React portal to escape `overflow-hidden` hero containers
- `src/lib/utils/getStateApprovalForElection.ts` — `getStateApprovalForElection(stateId)` for use in the election engine
- Uses same `isHigherBetter` map as national metrics for consistent metric direction
