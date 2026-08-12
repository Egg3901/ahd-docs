# Test Architecture and Coverage Gaps

> Audit date: 2026-03-23
> Scope: Vitest unit/integration tests, Playwright E2E tests, test utilities, mock infrastructure

---

## Investigation Summary

Audited 113 test files containing ~934 test cases across Vitest (unit/integration) and Playwright (E2E). The codebase has strong coverage of **pure calculation functions** (vote math, demographics, party org, formatting) but critical gaps in **orchestration systems** (turn processing, bill lifecycle, election resolution) and **security-critical paths** (auth, admin gates). The mock database utility enables fast tests but creates false confidence by not validating MongoDB queries or simulating real cursor behavior.

---

## 1. Test Organization

### Structure

| Layer           | Location                                       | Count | Naming                          |
| --------------- | ---------------------------------------------- | ----- | ------------------------------- |
| Unit tests      | Co-located `*.test.ts` next to source          | ~83   | `{module}.test.ts`              |
| API integration | `src/app/api/**/*.integration.test.ts`         | ~17   | `{feature}.integration.test.ts` |
| API route       | `src/app/api/**/route.test.ts`                 | ~5    | `route.test.ts`                 |
| Component/hook  | `__tests__/*.test.tsx`                         | ~5    | Standard RTL pattern            |
| DB integration  | `src/lib/__tests__/phase*.integration.test.ts` | 3     | Require `MONGODB_URI`           |
| E2E             | `e2e/*.spec.ts`                                | 3     | Playwright specs                |

### Configuration

- **Vitest** (`vitest.config.ts`): Node environment, globals, v8 coverage on `src/lib/**` only
- **Playwright** (`playwright.config.ts`): Chromium, parallel, 2 retries in CI, manual credentials

### Helpers and Fixtures

- **`src/lib/test-utils/mockDb.ts`** -- sole shared test utility; creates mock MongoDB `Db` with chainable cursors
- No shared test factories, fixtures, or builders
- No E2E seed scripts or fixture management

---

## 2. Test Classification by Purpose

### Strong Coverage (high-value, well-tested)

| Area                       | Key files                                 | Tests | Quality                                                      |
| -------------------------- | ----------------------------------------- | ----- | ------------------------------------------------------------ |
| Vote distribution math     | `electionEngine/voteDistribution.test.ts` | 27    | Exact numeric assertions, edge cases                         |
| Vote calculations          | `electionEngine/voteCalculations.test.ts` | 26    | Boundary conditions, multi-candidate                         |
| Party org calculations     | `turn/partyOrg/calculations.test.ts`      | 32    | Comprehensive formula testing                                |
| Party org utilities        | `utils/partyOrg.test.ts`                  | 32    | Diminishing returns, momentum caps                           |
| Inflation mechanics        | `budget/inflation.test.ts`                | 25    | Good range of economic scenarios                             |
| Demographic effects (pure) | `demographicEffects.test.ts`              | 15    | Tests `calculateDemographicShifts` with cancellation, bounds |
| Fund generation            | `utils/fundGeneration.test.ts`            | 26    | Formulas, edge cases                                         |
| Formatters                 | `utils/formatters.test.ts`                | 26    | Comprehensive formatting utils                               |
| Rate limiting              | `api/rateLimit.test.ts`                   | 11    | Window expiry, threshold behavior                            |
| Validation helpers         | `api/validate.test.ts`                    | 7     | Zod integration, error messages                              |
| Commodity data             | `constants/commodities.test.ts`           | 22    | Data integrity checks                                        |
| State adjacency            | `states/adjacency.test.ts`                | 14    | Graph completeness                                           |

### Adequate Coverage (tests exist, reasonable depth)

| Area                   | Key files                           | Tests | Notes                       |
| ---------------------- | ----------------------------------- | ----- | --------------------------- |
| NPP entry logic        | `turn/nppEntryLogic.test.ts`        | 12    | Decision tree coverage      |
| NPP vote logic         | `turn/nppVoteLogic.test.ts`         | 8     | Ideology alignment          |
| Whip resolution        | `turn/npp/whipResolution.test.ts`   | 10    | Whip compliance scenarios   |
| Election calculations  | `turn/electionCalculations.test.ts` | 25    | Timer math, seat allocation |
| Perpetual elections    | `turn/perpetualElections.test.ts`   | 9     | Spawning logic              |
| Archetype affinities   | `archetypeAffinities.test.ts`       | 14    | Alignment scoring           |
| Third-party mechanics  | `thirdPartyMechanics.test.ts`       | 11    | Spoiler modeling            |
| Influence calculator   | `influence/calculator.test.ts`      | 13    | Influence scoring           |
| Demographic appeal     | `utils/demographicAppeal.test.ts`   | 20    | Appeal formulas             |
| Presidential rebalance | `presidentialRaceRebalance.test.ts` | 18    | Rebalancing math            |
| Bond mechanics         | `bonds/sovereign.test.ts`           | 8     | Yield calculations          |
| Seat ID utilities      | `seats/seatId.test.ts`              | 17    | ID parsing/formatting       |

### Weak Coverage (tests exist but shallow or misleading)

| Area                       | File                                             | Tests | Problem                                                                                               |
| -------------------------- | ------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------- |
| **Election resolution**    | `turn/electionResolution.test.ts`                | 4     | Only tests `spawnHouseElection`; `resolveGeneralElections` (the actual resolution) has **zero tests** |
| **Campaign turn**          | `turn/campaignTurn.test.ts`                      | 1     | Single test asserts only `bulkWrite.toHaveBeenCalled()` -- no data validation                         |
| **Bill lifecycle helpers** | `billLifecycleHelpers.test.ts`                   | 4     | Tests trivial helpers (`didPass`, `otherChamber`); actual `processBillLifecycle` untested             |
| **Full turn flow**         | `api/cron/turn/fullTurnFlow.integration.test.ts` | 6     | All 40+ phases mocked; passes even if processTurn does nothing                                        |
| **Turn API auth**          | `api/cron/turn/turn.integration.test.ts`         | 5     | Tests HTTP auth layer only; turn logic entirely mocked                                                |
| **Cabinet nomination**     | `cabinetNominationLifecycle.test.ts`             | 2     | Minimal scenario coverage for complex lifecycle                                                       |
| **Metric history**         | `metricHistory.test.ts`                          | 1     | Single test                                                                                           |
| **Auth payload**           | `auth.payload.test.ts`                           | 2     | Tests JWT payload shape only                                                                          |

### Missing Coverage (no tests at all)

See Section 3 below for the full ranked list.

---

## 3. Ranked Coverage Gaps by Risk and Value

### Tier 1: Critical -- Core Game Loop and Security

| #   | File                                                           | Lines | Conditionals | Blast Radius                                      | Why it matters                                                                                                                           |
| --- | -------------------------------------------------------------- | ----- | ------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/lib/turnSystem.ts`                                        | 669   | ~48          | **Maximum** -- orchestrates all 40+ turn phases   | A bug here corrupts the entire game state every hour. No test verifies phase ordering, error isolation, or group sequencing.             |
| 2   | `src/lib/billLifecycle.ts`                                     | 467   | ~57          | **High** -- bill voting, passage, veto, enactment | Multi-chamber voting logic, presidential action windows, auto pocket-sign -- all untested. Only trivial helpers have tests.              |
| 3   | `src/lib/auth.ts`                                              | 135   | ~24          | **Critical** -- every authenticated request       | `verifyAuth()`, `getAuthUser()`, JWT validation -- zero unit tests. Auth integration tests exist but mock jose entirely.                 |
| 4   | `src/lib/api/requireAuth.ts`                                   | 80    | moderate     | **Critical** -- gates ~400 API routes             | The primary auth guard. No unit tests.                                                                                                   |
| 5   | `src/lib/api/requireAdmin.ts`                                  | 21    | low          | **High** -- gates all admin operations            | Untested. `claude.md` explicitly warns about bypassing this.                                                                             |
| 6   | `src/lib/turn/electionResolution.ts` (resolveGeneralElections) | ~200  | high         | **Critical** -- determines election winners       | `spawnHouseElection` has 4 tests; `resolveGeneralElections` has zero. This function updates electedOfficials, characters, and elections. |
| 7   | `src/lib/turn/primaryResolution.ts`                            | 544   | ~53          | **High** -- primary election outcomes             | Complete absence of tests for primary vote counting and candidate advancement.                                                           |

### Tier 2: High -- Major Subsystems

| #   | File                                           | Lines | Notes                                                                                |
| --- | ---------------------------------------------- | ----- | ------------------------------------------------------------------------------------ |
| 8   | `src/lib/turn/corporationTurn.ts`              | 942   | Largest turn phase, 102 conditionals. Corporate sector simulation entirely untested. |
| 9   | `src/lib/turn/ukGovernment.ts`                 | 551   | UK government formation, confidence/no-confidence votes. Zero tests.                 |
| 10  | `src/lib/turn/npp/leadershipVoting.ts`         | 410   | NPP leadership election logic. Zero tests.                                           |
| 11  | `src/lib/turn/bondTurn.ts`                     | 393   | Bond market processing, corporate defaults. Zero tests.                              |
| 12  | `src/lib/turn/election/presidentResolution.ts` | 393   | Presidential election resolution. Zero tests.                                        |
| 13  | `src/lib/electionEngine/tallyManagement.ts`    | 256   | Vote tallying and results calculation. Zero tests.                                   |
| 14  | `src/lib/turn/partyOrg/emptyPartyCleanup.ts`   | 332   | Deletes across 13+ collections. Zero tests. Cascade failure risk.                    |
| 15  | `src/lib/turn/commodityPriceTurn.ts`           | 328   | Commodity market simulation. Zero tests.                                             |

### Tier 3: Medium -- Supporting Systems

| #   | File                                            | Lines | Notes                                               |
| --- | ----------------------------------------------- | ----- | --------------------------------------------------- |
| 16  | `src/lib/turn/npp/context.ts`                   | 286   | Shared NPP context loader -- used by all NPP phases |
| 17  | `src/lib/turn/npp/electionEntry.ts`             | 216   | NPP election entry decisions                        |
| 18  | `src/lib/turn/nppActionProcessing.ts`           | 227   | NPP action execution (every 4 turns)                |
| 19  | `src/lib/turn/npp/speakerRecalculation.ts`      | 174   | Speaker of the House recalculation                  |
| 20  | `src/lib/turn/npp/billVoting.ts`                | 113   | NPP bill voting implementation                      |
| 21  | `src/lib/turn/nppFundGeneration.ts`             | 176   | NPP economic model                                  |
| 22  | `src/lib/turn/archetypeApprovalDecay.ts`        | 128   | Approval rating decay                               |
| 23  | `src/lib/turn/election/seatAllocation.ts`       | 126   | Seat allocation after elections                     |
| 24  | `src/lib/turn/election/electionSpawning.ts`     | 89    | Election creation                                   |
| 25  | `src/lib/api/requireAdminOrApiKey.ts`           | 41    | Dual auth path for automation                       |
| 26  | `src/lib/electionEngine/candidateEnrichment.ts` | 100   | Candidate data enrichment                           |

### Tier 4: Lower -- Utilities and Snapshots

| #     | Files                                                                                                                                                                         | Notes                                       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 27-35 | `fundGeneration.ts`, `inflationRecalc.ts`, `corporateGdpGrowth.ts`, `portfolioSnapshot.ts`, `interestRateSnapshot.ts`, `partyActionGeneration.ts`, `ukGovernmentFormation.ts` | Smaller turn phases, less complex branching |

---

## 4. False-Confidence Tests

These tests pass but provide misleading assurance:

### 4a. Mock Database Doesn't Validate Queries

**File:** `src/lib/test-utils/mockDb.ts`

The mock creates stub collections where `find()`, `findOne()`, `updateOne()` etc. accept any arguments and return pre-configured values. This means:

- A broken MongoDB filter `{ stauts: "active" }` (typo) passes all tests
- Incorrect `$set` operators in `updateOne` go undetected
- Aggregation pipelines are completely ignored -- `aggregate()` returns a stub `toArray()`
- ObjectId comparison is never validated (mock uses string IDs)

**Impact:** Any test using `createMockDb()` cannot detect broken queries. This affects ~80+ test files.

### 4b. Full Turn Flow "Integration" Test

**File:** `src/app/api/cron/turn/fullTurnFlow.integration.test.ts`

Claims to test the full turn cycle but mocks every sub-processor and every database operation. The test passes if `processTurn()` calls the right functions in the right order -- but doesn't verify any phase produces correct output or that data flows between phases.

**Specific false confidence:** The test asserts `gameState.updateOne` was called, but doesn't check what was written. Turn could increment by 0, -1, or 999 and the test passes.

### 4c. Campaign Turn Test

**File:** `src/lib/turn/campaignTurn.test.ts`

Single test asserts `bulkWrite.toHaveBeenCalled()` with no inspection of the bulk operations. Income calculation, action generation, maintenance costs, and endorsement effects are all unchecked.

### 4d. Election Resolution Tests

**File:** `src/lib/turn/electionResolution.test.ts`

Tests `spawnHouseElection` parameters but never verifies the election document written has correct status, dates, or candidate configuration. Tests check `insertOne` was called, not what was inserted.

---

## 5. Brittle Tests

### 5a. Next.js Header Mocking

Multiple integration tests mock `next/headers` with:

```ts
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn() }),
  headers: vi.fn().mockResolvedValue({ get: vi.fn() }),
}));
```

These break whenever Next.js changes the headers API (happened in Next.js 15 and 16). Each test file re-implements this mock slightly differently.

### 5b. Hard-coded Mock Return Values

Tests like `fullTurnFlow.integration.test.ts` hard-code mock returns that mirror current implementation details:

- If a function signature changes (e.g., returns a different shape), mocks silently return stale data
- No type-safety between mock return values and actual function signatures

### 5c. E2E Tests with Flexible Text Matching

E2E tests use patterns like:

```ts
expect(body).toMatch(/elections|no elections found|loading|to participate/i);
```

This passes for almost any page content and provides no meaningful assertion about the elections feature actually working.

---

## 6. E2E Coverage Assessment

### Current State: Smoke-Only

| Test File                    | Tests | What It Actually Verifies                                        |
| ---------------------------- | ----- | ---------------------------------------------------------------- |
| `e2e/smoke.spec.ts`          | 6     | Pages load, login form has fields, login redirects               |
| `e2e/critical-flows.spec.ts` | 3     | Elections/congress pages show generic text, logged-in navigation |
| `e2e/performance.spec.ts`    | 4     | Pages load within 5-10s threshold                                |

### Missing E2E Workflows

Every interactive game feature is untested end-to-end:

1. User registration and character creation
2. Voting in elections
3. Bill creation and voting
4. Campaign launch and management
5. Party join/leave/management
6. Fund allocation
7. Admin operations
8. Cross-page data consistency (e.g., vote shows in election results)

### Infrastructure Gaps

- No E2E test fixtures or seed data
- No programmatic test account creation
- Manual `.env.local` credential setup
- No database state management between tests

---

## 7. Prioritized Coverage Expansion Plan

### Phase 1: Secure the Core (Weeks 1-2)

**Goal:** Test the systems where bugs cause maximum damage.

| Priority | Target                                              | Test Type          | Key Scenarios                                                                                           |
| -------- | --------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------- |
| P0       | `auth.ts` + `requireAuth.ts`                        | Unit               | Valid JWT, expired JWT, missing token, tampered payload, role extraction                                |
| P0       | `requireAdmin.ts`                                   | Unit               | Admin user passes, non-admin blocked, missing character                                                 |
| P0       | `billLifecycle.ts` (`processBillLifecycle`)         | Unit + integration | Bill voting opens, passes/fails, advances chambers, presidential action, veto override at 2/3 threshold |
| P0       | `electionResolution.ts` (`resolveGeneralElections`) | Integration        | Winner determination, electedOfficials creation, character office update, notification dispatch         |
| P1       | `turnSystem.ts` (`processTurn`)                     | Integration        | Phase ordering verified, error isolation (one phase fails, others continue), GameState increment        |
| P1       | `primaryResolution.ts`                              | Unit + integration | Primary vote counting, candidate advancement to general, tied primaries                                 |

### Phase 2: Subsystem Integrity (Weeks 3-4)

| Priority | Target                          | Test Type   | Key Scenarios                                                                |
| -------- | ------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| P1       | `corporationTurn.ts`            | Unit        | Revenue calc, workforce growth, credit rating changes, quarterly processing  |
| P1       | `ukGovernment.ts`               | Integration | Government formation after election, confidence vote mechanics, PM selection |
| P1       | `partyOrg/emptyPartyCleanup.ts` | Integration | Cascade deletion across 13+ collections, no orphaned documents               |
| P2       | `bondTurn.ts`                   | Unit        | Coupon payments, default triggers, interest rate effects                     |
| P2       | `presidentResolution.ts`        | Integration | Electoral vote allocation, winner determination, tie scenarios               |
| P2       | `tallyManagement.ts`            | Unit        | Vote accumulation, tally correctness                                         |
| P2       | `npp/leadershipVoting.ts`       | Unit        | Leadership election triggers, NPP voting decisions                           |

### Phase 3: Mock Infrastructure Upgrade (Week 3, parallel)

| Priority | Target                         | Change                                                                                |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| P1       | `mockDb.ts`                    | Add filter validation: mock `find`/`findOne` should warn on unknown collection fields |
| P1       | `mockDb.ts`                    | Track inserted/updated documents so tests can assert on actual written data           |
| P2       | `mockDb.ts`                    | Add `assertCalledWithFilter(expectedFilter)` helper for common query patterns         |
| P2       | New: `test-utils/factories.ts` | Create typed factories for common test documents (Election, Character, Bill, Party)   |

### Phase 4: E2E Beyond Smoke (Weeks 5-6)

| Priority | Target        | What to Add                                        |
| -------- | ------------- | -------------------------------------------------- |
| P2       | E2E fixtures  | Programmatic seed script for test database state   |
| P2       | Auth flow E2E | Register -> create character -> verify dashboard   |
| P3       | Election E2E  | View election -> vote -> verify vote counted       |
| P3       | Congress E2E  | View bills -> vote on bill -> verify vote recorded |

---

## 8. Metrics (Current State)

| Metric                          | Value                                                      |
| ------------------------------- | ---------------------------------------------------------- |
| Total test files                | 113                                                        |
| Total test cases                | ~934                                                       |
| Vitest unit/integration         | 110 files, ~921 tests                                      |
| Playwright E2E                  | 3 files, 13 tests                                          |
| Coverage scope                  | `src/lib/**` only (excludes `src/app/`, components, hooks) |
| Turn phase files with tests     | 14 of 42 (~33%)                                            |
| Turn phase files without tests  | 28 (~67%)                                                  |
| Auth/security files with tests  | 3 of 7 (~43%, and those 3 are shallow)                     |
| API routes with tests           | ~23 of ~409 (~5.6%)                                        |
| Lines of untested critical code | ~5,500+ across 51 files                                    |

---

## 9. Remaining Risks and Deferred Issues

### Structural Risks

1. **No CI coverage gate** -- coverage can regress silently. Consider adding a minimum threshold for `src/lib/turn/` and `src/lib/api/`.
2. **Integration tests require real DB** -- the phase1/2/3 integration tests skip when `MONGODB_URI` is missing, which likely includes CI. These tests may never actually run.
3. **No test for cross-collection consistency** -- the system's biggest failure mode (partial writes across collections) has zero test coverage. Would require either transactions in tests or a dedicated consistency-check test.
4. **E2E tests depend on external state** -- no fixture management means E2E results are non-deterministic.

### Deferred (Out of Scope for This Audit)

- API route coverage expansion for all 409 routes (recommend risk-based selection)
- Component test coverage (low blast radius, skip per `claude.md` guidance)
- Performance regression tests beyond current load-time checks
- Chaos/fault-injection testing for turn processing resilience
