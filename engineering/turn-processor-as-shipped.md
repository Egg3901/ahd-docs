# The Turn Processor (as shipped)

Every hour, one function advances the entire game world by one turn: `processTurn()` in `src/lib/turnSystem.ts`. It acquires a lock on the singleton `gameState` document, runs a registry of phase adapters covering the economy, parties, legislation, elections, government formation, and telemetry, then advances the game clock and writes a `turnLog`. This document describes the processor as it actually runs today, grounded in the current code. It supersedes the older `design/turn-processing.md` where the two disagree.

## Time model

Constants live in `src/lib/constants/turnTime.ts`: 48 turns = 1 game year (`TURNS_PER_YEAR`), 1 turn = 1 game week, and `MS_PER_TURN` maps 1 turn to 1 real hour. `STARTING_YEAR` is 2019 by default; each world's `gameState.startingYear` plus `preset` (one of `SEED_PRESET_IDS`: 1953, 1979, 1991, 1999, 2007, 2019, 2023 defaults) anchors its calendar. Fast mode halves the interval to 30 minutes (`toggleFastMode`).

## Cron entry

The entry point is `GET /api/cron/turn` (`src/app/api/cron/turn/route.ts`), fired hourly. Details that matter operationally:

- Auth is `requireCron`, checking the `Authorization` header against the `CRON_SECRET` env var. Failures return 401 with a log line distinguishing "secret not configured" from "header missing" from "mismatch".
- `maxDuration = 800` seconds. A completed turn taking over 300s raises a Sentry/GlitchTip "Slow turn" warning; per-phase guards are expected to fail first.
- Two cron entries per hour, tagged `?source=primary` (:00) and `?source=backup` (:30). The primary always proceeds (the processing lock prevents double fires). The backup only fires if no turn completed in the current UTC clock hour (`shouldFireBackupTurn`), so a one-off :30 recovery cannot pin the schedule there. In fast mode both slots are real turns and the backup fires unconditionally.
- If `gameState.isActive` is false the route returns `{ skipped: true }` without touching the lock.
- HTTP status: 200 for any turn that ran, even with phase warnings; 500 only when no turn was processed at all (`turn === 0`, `success === false`). Degraded or failed turns also emit a structured turn-health metric (`captureTurnHealth`).

Other cron routes under `src/app/api/cron/` (`price-update`, `stock-exchange-refresh`, `index-fund`, `fog-update`, `patreon-reconcile`) are separate jobs, not part of the turn.

## Locking, recovery, and failure

The lock is a set of fields on the `gameState` `_id: "current"` document (`isProcessing`, `processingKind`, `processingStartedAt`, `processingTargetTurn`, `processingHeartbeatAt`, `processingPhase`, `processingPhaseStatuses`). Acquisition is a single `findOneAndUpdate` that succeeds only if no lock is held or the held lock is stale. Constants come from `src/lib/turn/processingLock.ts`:

- `TURN_LOCK_STALE_MS` = 20 minutes. A lock whose heartbeat is older than this can be taken over by a later cron tick.
- `TURN_LOCK_HEARTBEAT_MS` = 30 seconds. While any phase runs, a timer refreshes `processingHeartbeatAt`.

Safety layers around the lock:

- **Auto-pause drift guard.** Before locking, if wall-clock time since the last completed turn (by `turnLog.realTime`, floored at the most recent `lastResumedAt`) exceeds the auto-pause threshold, the world pauses itself with `pauseKind: "auto-drift"` and a Sentry error. This catches "cron stopped firing" rather than letting the game clock silently drift. Sandbox sim worlds (`gameConfig.simSandbox`) are exempt, since headless runs have no cron.
- **Crashed-turn recovery (#2815).** A turn's ~180 phases commit writes directly; there is no wrapping transaction (turns run tens of seconds over thousands of documents, past Mongo's per-transaction limits). If the previous lock holder died mid-turn after phases began committing, re-running the turn would double-apply income phases. So `processTurn` detects the stale mid-flight lock (`shouldRecoverCrashedTurn`), and instead of re-running, it consumes the turn number: advances `currentTurn`, `currentYear`, and `lastTurnProcessed` by exactly one turn and skips, logging which phase the crash occurred in.
- **Graceful shutdown.** A module-level `localTurnLockHeld` flag marks whether this process owns the lock. On SIGTERM (Railway redeploy mid-turn) the shutdown handler calls `releaseLocalProcessingLock`, guarded by `isProcessing: true` so it never clears a lock a newer process re-acquired. Without this, a redeploy mid-turn stranded the lock for the full 20-minute stale window (the 2026-07 stuck-turn incident).
- **Phase failure.** `runPhase` (see Telemetry below) catches a phase's throw, records it as failed, pushes a warning, and returns null; the turn continues. A phase also hard-times-out at `PHASE_TIMEOUT_MS` = 4 minutes. Only an error outside any phase aborts the turn: the catch block in `processTurn` releases the lock, finalizes phase statuses via `finalizeAbortedPhaseStatuses`, and still writes a crash `turnLog` and health snapshot so the failure is inspectable.

On success the processor advances the clock, clears the lock, writes the `turnLog` (turn, year, `durationMs`, warnings, `phaseStatuses`, per-phase `phases` results), and emits `turn_start`/`turn_complete` events.

## Phase registry and ordering

Phases are organized as adapters returned by `getTurnPhaseRegistry()` in `src/simulation/phases/turnPhaseRegistry.ts`. Each adapter's `execute(context, runtime)` runs one thematic group; inside a group, individual phases run through `runtime.runPhase(name, fn)`. The canonical name list is `BASE_TURN_PHASE_NAMES` in `src/simulation/phases/turnPhaseNames.ts`: 123 base phases, plus 57 per-country election phases contributed by `COUNTRY_ELECTION_PHASES` in `src/lib/turn/countryPhases.ts` (that file also registers 16 per-country bill-lifecycle phases, which are in the base list), for roughly 180 named phases per turn.

Groups execute strictly in registry order:

| # | Group (adapter key) | Purpose, representative phases |
|---|---|---|
| 1 | `expiredBannedShareholderCleanup`, `inactiveShareholderShareRelease` | Release shares held by banned/inactive users and inactive-CEO corps before dividends settle. |
| 2 | `resourceAndFinanceStart` | The economy: disaster/crisis spawners, `autoSectorSeed`, `extractionAutoStrategy`, `actionRefresh`, `fundGeneration`, `corporationTurn` (the whole sector engine), `nppCorporateAttacks`, `unionsTurn`, `nppUnionBehavior`, `decolonization`, `partyInfluenceTurn`, `caucusTax`, `treasuryTurn`, `nppFundGeneration`, `savingsInterestTurn`, `prospectingResolution`, `macroCountryTurn`, `sphereSponsorTurn`, `bondTurn`, `commodityPrices`, `contractSettlement`, `lineOfCreditTurn`, `recomputeSharePrices`, `financialSuspectScan`. |
| 3 | `demographicsAndPartySetup` | Turnout decay and GOTV, `partyOrgTurn`, Reg/pressure/support decay and accrual, `partyTierTurn`, state/national/committee party elections, `partyActionGeneration`, charter expiry and empty-party cleanup, NPP relationship maintenance, `governorLegislationQueue`, `nppBillSponsorship`, `generateChallengers`, `nppBehavior` (NPP candidacies and votes). |
| 4 | `billsCampaignsAndActivity` | `billLifecycle` plus the 16 country bill lifecycles (UK/JP/IE/DE, CN and the one-party bloc RU/DD/PL/CS/HU/RO/BG/YU/UKR/BLR/BAL), `stateBillTimers`, `cabinetNominations`, `scotusTurn`, `ukJrSurpriseTurn`, `fomcNominations`, then sequentially `socialAxisDrift`, governor's-office phases (`officeStateSeed`, `governorAPRegen`, executive orders, address expiry, endorsements), `campaignTurn`, `playerRandomEvents`, world-events maintenance/scheduler, `nppActionProcessing`, `activityLogging`. |
| 5 | `electionResolutionAndGovernment` | Strictly sequential: `candidatePartySweep`, `primaryResolution`, `voteAccumulation`, `campaignSpendReset`, `electionTimers`, `primarySnapshots`, `electionResolution`, `clearResolvedSupport`, `leadershipVacate`, then parliamentary government formation/votes/vacancy watcher and `nppGovernmentPhases`. Reordering here corrupts elections (dropped final-turn votes, offices resolved from stale tallies). |
| 6 | `electionCoverageAndSuccession` | `detectPreIterationComplete`, `withdrawInactiveCandidates`, then the 57 per-country `ensure*Elections` spawner phases plus `perpetualElections` in parallel (suppressed while the founding phase is active), `byElectionWatcher`, `leadershipElections`, `staleCandidateCleanup`, `internationalOrganizations`, then `alignment`, `autoReelectionEntry`, `impeachmentLifecycle`, `presidentialSuccession`. |
| 7 | `fiscalYearBoundary` | `fiscalYear`, only on year-boundary turns (`isFiscalYearEnd`); marked skipped otherwise. |
| 8 | `stateEffectsAndNationalAggregation` (`src/simulation/phases/stateEffectsPhase.ts`) | The largest group: `crisisTurn`, `ministerialOrders`, `policyEffects`, `demographicEffects` (followed sequentially by the era-checkpoint pull, see the granular-electorate doc), decay phases, regional budgets, `metricEngine`, `demographicFlows`, `census`, `eraCrossing`, `nationalMetrics`, `economicModel`, `inflationRecalc`, `commandEconomy`, `forexTurn`, central-bank/FOMC phases, `referendumLifecycle`, then the snapshot battery (`metricHistory`, `approvalSnapshot`, portfolio/stock-exchange/wealth snapshots), `auditAnomalyScan`, `suspiciousDetection`, `gameHealthSnapshot`. |
| 9 | `indexFunds`, `moneySupplySnapshot` | Index-fund NAV/rebalance cron (flag-gated) and the per-currency money-supply snapshot. |
| 10 | `ledgerBalanceSnapshot`, `ledgerReconcile` | Shadow ledger, registered last so it snapshots after every value-affecting phase. Flag-gated (`ledgerShadow`, on by default in prod seeds). |

## Parallelism and its constraints

Parallelism is used only inside a group, via `Promise.all`, and only where phases touch disjoint state. Documented constraints in the registry:

- Group 2 runs `actionRefresh`, `fundGeneration`, and `corporationTurn` in parallel, and later `bondTurn` with `commodityPrices`; everything with a read-after-write dependency (unions after corporations, treasury after SOE remittance, prospecting before commodity prices, contract settlement after them) is sequential with a comment stating why.
- Group 4 runs the bill lifecycles, SCOTUS, and nomination lifecycles in one `Promise.all`, then `socialAxisDrift` sequentially after, because it reads the `statePolicies` rows the bill phases just wrote.
- Group 6's country election spawners are concurrent; ordering within a country's list is best-effort only (the JP council spawner recomputes the Shugiin cycle if the concurrently created race is not yet visible).
- `internationalOrganizations` and `alignment` must not run together: alignment reads org memberships the other writes. Same class of lost-update race is documented in `stateEffectsPhase.ts` (the S4 comment) and in `eraCheckpointTurn.ts`.
- `runParliamentaryGovernmentPhases` iterates 27 countries sequentially with per-country try/catch isolation, so one country's throw cannot starve every later country of PM appointment and confidence resolution.

## Conditional and skipped phases

Phases can be skipped with a recorded reason (`markPhaseSkipped`): `manualPause` (admin paused corporation actions skips `corporationTurn` and the disaster spawners), `featureDisabled` (prospecting, contract settlement, index funds, shadow ledger), `conditional` (fiscal year off-boundary), and `simElectionsOnly` (headless worldsim profiles via `gameConfig.simTurnPhaseMode`, inert in production). Bond servicing deliberately still runs while corporation actions are paused: existing coupons and maturities are contracts, not corporation actions.

## Telemetry

`createTurnPhaseRuntime` (`src/simulation/engine/turnPhaseRuntime.ts`) wraps every phase with:

- **Status map.** An in-memory `TurnPhaseTelemetryMap` (pending/running/completed/skipped/failed/notReached with timestamps), persisted into the final `turnLog.phaseStatuses`. Live progress writes to `gameState.processingPhaseStatuses` feed the turn-progress overlay (`/api/game/turn/status`), coalesced to at most one DB flush per `PHASE_STATUS_FLUSH_THROTTLE_MS` = 1500 ms; terminal/abnormal transitions always flush.
- **Heartbeat.** A 30-second interval per running phase refreshes the lock heartbeat.
- **Timeout.** 4 minutes per phase (`PHASE_TIMEOUT_MS`), converted to a phase failure, not a turn abort.
- **Tracing.** Each phase runs as a Sentry span `turn.phase.<name>` under the cron transaction, with start/complete breadcrumbs carrying `durationMs`, so GlitchTip shows a per-phase waterfall. Failures are captured with the phase name.
- **Audit spine.** Mutating phases (everything not in the curated `READ_ONLY_PHASES` set of snapshot/scan phases) emit a coarse `recordAudit` envelope with traceId `turn:<n>:<phase>`, shared with any fine-grained audit rows written inside the phase. No-op unless `gameConfig.auditLog` is on.

The turndiag MCP tooling reads `turnLogs` for phase timings, regressions, and lock status; `gameHealthSnapshot` (written even on crash) is the per-turn health record.
