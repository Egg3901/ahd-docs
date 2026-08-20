# Core Systems

The core systems define how time, actions, and offices work in A House Divided. Understanding these will help you plan campaigns, manage resources, and climb the political ladder.

## Turn Structure

- **Turn Length**: 1 hour
- **Turns Per Day**: 24 turns
- **Real-Time**: Game operates continuously in real-time
- **Action Economy**: Fixed number of actions per turn (base amount + bonus for office holders)

## Term Cycles

All term cycles are synchronized to align election periods:

| Office    | Term Length | Notes                                      |
| --------- | ----------- | ------------------------------------------ |
| President | 8 days      | All at once                                |
| Senate    | 12 days     | 3 staggered classes (Class 1, 2, 3 rotate) |
| House     | 4 days      | All seats at once                          |

### Senate Staggered Classes

Senate has 3 classes that rotate so one-third is up for election every 4 days:

```senate-classes

```

This ensures continuous Senate activity with elections happening at different times.

## Game World Persistence

- **Type**: Continuous server-based world
- **Players**: Join and leave dynamically
- **Empty Seats**: Filled by NPPs, Non-Player Politicians automatically enter elections and hold office (see [[NPP System]])
- **No Resets**: Game runs continuously without seasonal resets
- **State Data**: Population and GDP data loaded per state (used for campaign costs and donor pools)
- **Perpetual Elections**: All race types (house, senate, governor, stateSenate) spawn a new cycle immediately after the previous one resolves, no seat ever goes permanently uncontested

## Action System

- **Base Actions**: 4 actions per turn
- **Office Bonus**: Tiered by office held
  - House: +1 (5 total)
  - State Senate: +1 (5 total)
  - Senate: +2 (6 total)
  - Vice President: +2 (6 total)
  - Governor: +2 (6 total)
  - President: +4 (8 total)
- **Starting Actions**: 25 (one-time grant on character creation)
- **Action Spending**: Players spend actions to perform various activities
- **Action Regeneration**: Actions accumulate each turn (added to existing pool; unused actions carry over)
- **Action Cap**: 200 max; hoarding penalty −4/turn when holding > 100 actions

## Action Costs

| Action                | Actions | Funds                           | Effect                                           |
| --------------------- | ------- | ------------------------------- | ------------------------------------------------ |
| Campaign              | 1-5 (tiered by state PI) | −$20,000 × tier, GDP-scaled   | +1% Political Influence                          |
| Fundraise             | 3 (flat)     | Earns $50k + $2k × donor level, scaled by state influence (1.0x, 2.0x) and the Fundraising stat | Requires donor base > 0 |
| Run Advertisements    | 5-9 (tiered by favorability) | −$100,000, GDP-scaled          | Favorability effect (diminishing at high favorability) |
| Build Donor Network   | 4-20 (power curve by level) | −$3k − $1.5k × current level, GDP-scaled | +1 Donor Network Level                    |
| Quick Poll            | 2       | −$25,000                        | Topline appeal + best/worst 5 groups             |
| Full Demographic Poll | 6       | −$75,000                        | Complete breakdown by every demographic category |

### Out-of-State Costs

- The state-adjacency multiplier applies to interpersonal actions (Support, Attack, Barnstorm), not to Campaign or Advertise, which use GDP-based fund scaling instead
- Home state: 1.0× | Neighboring state: 1.25× | Non-neighboring: 1.5×

## Per-Turn Processing Order

Each turn runs about **12 phase groups** and **~105 `runPhase` calls**. Phases within a group marked **(parallel)** execute concurrently via `Promise.all`; all others run sequentially. Each phase is error-isolated via `runPhase()`, a failure logs to Sentry but does not halt subsequent phases.

The numbered table below is a historical outline of the pipeline, not the live 12-adapter registry in `turnPhaseRegistry.ts`.

| Group                    | Phases                                                                                                          | Key constraint                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1. Resources             | Action refresh, fund generation, corporation turn                                                               | Parallel-safe                                         |
| 1a. Finance              | Bond coupons, NPP funds, commodity prices, portfolio snapshots                                                  | After corporations (bonds need updated liquidCapital) |
| 2. Demographics          | Turnout decay, party GOTV, party org momentum                                                                   | Sequential                                            |
| 3. Party elections       | State/national/committee elections, party actions, empty party cleanup                                          | Parallel then cleanup                                 |
| 4. NPP behavior          | Election entry, federal/local bill voting, manual-endorsement cleanup, leadership-vote no-op guard              | Uses shared `loadNPPContext()`                        |
| 5. Bills & cabinets      | Bill lifecycle (federal + state + UK Commons), cabinet nominations                                              | Parallel-safe                                         |
| 6. Campaigns             | Campaign turn, NPP action processing (every 4 turns)                                                            | Sequential                                            |
| 7. Election resolution   | Primary resolution → vote accumulation → timer advancement → snapshots → general resolution → leadership vacate | **Strictly sequential, ordering is load-bearing**    |
| 8. UK government         | Government formation, no-confidence votes, confidence votes                                                     | After election resolution                             |
| 9. Election coverage     | Perpetual elections, UK elections, leadership elections, stale cleanup, coalition disband vote resolution       | Parallel-safe                                         |
| 10. Fiscal year          | October processing (turn 36 of 48)                                                                              | Conditional                                           |
| 11. Effects & metrics    | Policy effects, demographic effects, approval decay, corporate GDP, **unowned sector growth**                   | Parallel-safe                                         |
| 12. National aggregation | National metrics, inflation, central bank chair                                                                 | After state effects                                   |
| 13. History              | Metric snapshots, approval snapshots, interest rate snapshots                                                   | Parallel-safe                                         |
| 14. Persistence          | Increment GameState turn, save TurnLog, emit SSE                                                                | **Critical, not wrapped in try/catch**               |

**Invariants:**

- **Group 7 ordering is critical:** primaries must resolve before vote accumulation; votes must accumulate before timers advance; timers must advance before elections resolve
- `GameState` document (`_id: "current"`) tracks turn counter, year, and activity status
- Feature gates: `nppEconomyEnabled` controls NPP fund generation; NPP actions run every 4 turns
- Turn processor passes shared state data between phases to avoid redundant DB queries

See `technical-architecture.md` for the full implementation details of each phase.

## Real-Time Synchronization

- All players act within the same time windows
- Server-enforced deadlines prevent clock drift
- Polling and vote accumulation update each turn

## Cabinet System

The President nominates advisors to cabinet positions; the Senate confirms or rejects.

- **Positions**: 15 principal officer roles (Secretary of State, Treasury, Defense, Attorney General, Interior, Agriculture, Commerce, Labor, HHS, HUD, Transportation, Energy, Education, Veterans Affairs, Homeland Security)
- **Nomination**: President selects any character and a cabinet position via `/whitehouse/cabinet`
- **Senate vote**: Senators vote For / Against / Abstain within a 24-hour window; simple majority confirms
- **Confirmed**: Character added to `cabinetMembers`; appears on the cabinet page
- **Fire**: President can remove any confirmed member at any time
- **Senate view**: Active nominations also appear on the Congress page; dedicated "Vote in Senate" link on the Cabinet page when nominations are pending
- **API**: `GET /api/whitehouse/cabinet`, `POST /api/whitehouse/cabinet/nominations`, `POST /api/whitehouse/cabinet/fire`

See [Cabinet](./cabinet.md) for full documentation.

## Campaign Manager System

Each player election candidacy has an associated campaign with a dedicated management page at `/campaign/[id]`.

- **Access tiers**: Campaign owner sees full management UI; party members see intelligence view; public sees a basic summary
- **Resource management**: Track actions earned per turn, funds allocation, and operation categories
- **Campaign operations**: Strategic upgrades, activity logs, budget analysis
- **Endorsements**: Displays NPP endorsement count and details
- **Manager assignment**: Admin can assign a manager to a campaign via API

See [Campaign Manager](./campaign-manager.md) for full documentation.

## Player Mail System

Players can send in-game messages to other characters. See [[Mail]] for full documentation.

- **Access**: "Send Mail" button on character profile pages opens the Mail Composer Modal
- **Inbox**: Notifications page → Mail tab; unread count shown in navbar badge
- **Rate limit**: 1 message per minute per sender
- **Formatting**: Markdown-lite (`**bold**`, `*italic*`)
- **Moderation**: Report button → admin mail reports queue with dismiss/delete/warn/ban actions

## Coalition System

National party chairs can form cross-party coalitions. See [[Coalitions]] for full documentation.

- **Formation**: Any national party chair; requires name, abbreviation, color
- **Membership**: Invite flow and join request flow
- **Disband**: 24-hour majority vote; resolved during turn processing
- **Status**: Organizational only, no gameplay effects yet

## News / Posts System

Players can publish news posts that others can react to and comment on.

- **Post creation**: Available from the `/news` page; requires a character
- **Feed**: Reverse-chronological post feed with reactions and comment counts
- **Leaderboard**: Ranks players by engagement metrics (reactions + comments)
- **Achievements**: Linked to First Post, commenting milestones, and subscriber count
- **Collections**: `newsPosts`, `newsReactions`

### Automated / System-Generated News

The game also generates news posts automatically as part of turn processing. These are distinguished from player posts by the `isSystem: true` flag and are attributed to "National Wire Service" (a sentinel author with ID `000000000000000000000000`). System posts appear in the same feed as player posts but cannot be authored or edited by players.

Automated news functions (all in `src/lib/news.ts`):

- **`generateElectionNews(outcomes)`**, fired after general election resolution. Groups results by election type (US House, US Senate, Gubernatorial, UK Parliament, etc.) and emits an aggregated post: if multiple races resolved, it summarizes party win counts (e.g., "US House Results (12 races): Democratic 7, Republican 5") and calls out any player winners by name. Single-race results name the winner directly.
- **`generateBillSignedNews(billTitle, sponsorName, scope, state?)`**, fired when a president or governor signs a bill into law. Posts a "New Law" notice with the bill title, sponsor, and jurisdiction (federal or state-level).
- **`generateBillVetoedNews(billTitle, scope, state?)`**, fired when a bill is vetoed. Posts a notice naming the executive who vetoed and noting that an override may be attempted.

All automated news fires from within turn processing phases, not as player actions. The `category` field is set to `"election"` for election news and `"legislation"` for bill news, enabling category-based filtering in the feed.
