# Domain Reuse Guidelines

Rules for when to extract shared domain logic in A House Divided, and when to keep logic inline. Complements [`shared-utility-guidelines.md`](./shared-utility-guidelines.md) which covers generic (non-domain) helpers.

## Core principle

**Domain semantics trump DRY purity.** Duplicating a formula once is cheaper than a wrong abstraction that hides what the game is doing. Only extract when the behavior is genuinely identical and a single name makes the code clearer.

## When to extract domain logic

Extract when **all three** conditions hold:

1. **Same formula, same meaning.** The code is not just structurally similar — it represents the same game concept. Two different `Math.max(0, Math.min(100, x))` calls with different domain bounds are not "the same."
2. **A bug fix must apply everywhere.** If the formula drifts between call sites, game behavior becomes inconsistent in ways players would notice (e.g., NPP compliance calculated differently in bill voting vs leadership voting).
3. **A domain-specific name clarifies intent.** `calculateComplianceChance(npp)` is better than inlining `loyalty * 0.7 + (1 - stubbornness) * 0.3` three times, because the name communicates the game concept.

## When to keep logic inline

- **Different fallback chains.** Policy option lookup in `billEnactment.ts` (id → effectDirection → center fallback) differs from `policyEffects.ts` (id → effectDirection, no center fallback) and `billEnrichment.ts` (id only). Forcing these into one helper would hide the intentional differences.
- **Different clamp bounds.** Metric clamping uses different min/max per context (`0–100` for approval, `−10–+10` for momentum, `−20–+20` for demographic modifiers). A generic `clamp()` hides the domain-specific bounds.
- **Different `MIN_CHANGE_THRESHOLD` values.** Policy effects use `0.001`, demographics use `0.0001`. These are tuned independently.
- **One-off validation guards.** A "candidate must be in home state" check appears once in election entry — no need to extract.

## Established reuse patterns

These are already extracted and should be used consistently:

| Domain concept              | Canonical location                                                                 | Notes                                                                |
| --------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------- | ------ | -------- | ----------------------- |
| NPP compliance chance       | `calculateComplianceChance()` in `src/lib/turn/nppVoteLogic.ts`                    | `loyalty * 0.7 + (1 - stubbornness) * 0.3` — use this, don't inline  |
| NPP whip resolution         | `resolveWhipForNPP()` in `src/lib/turn/npp/whipResolution.ts`                      | State-over-national priority, optional country collision prevention  |
| NPP country detection       | `getNPPCountry()` in `src/lib/turn/npp/whipResolution.ts`                          | `countryId` field → fallback to `getCountryIdFromStateId(homeState)` |
| Ideology alignment score    | `alignmentScore()` in `src/lib/turn/npp/leadershipVoting.ts`                       | `max(0, 100 -                                                        | econ_diff | \* 5 - | soc_diff | \* 5)` — 0 to 100 scale |
| Leadership voting constants | `PARTY_MATCH_BONUS`, `REAL_PLAYER_BONUS` in `src/lib/turn/npp/leadershipVoting.ts` | Shared by speaker recalculation and turn-based leadership voting     |
| NPP base/whipped vote       | `calculateBaseVote()`, `calculateWhippedVote()` in `src/lib/turn/nppVoteLogic.ts`  | Ideology + personality + whip compliance                             |
| Bill passage check          | `didPass()` in `src/lib/billLifecycleHelpers.ts`                                   | Simple majority: `votesFor > votesAgainst`                           |
| Policy decay                | `applyPolicyDecay()`, `getPolicyDecayFactor()` in `shared/constants/formulas.ts`   | Exponential decay with configurable tau                              |
| Half-life decay             | `applyHalfLifeDecay()` in `shared/constants/formulas.ts`                           | `initial * 0.5^(turns / halfLife)`                                   |
| Policy contribution         | `calculatePolicyContribution()` in `shared/constants/formulas.ts`                  | Normalized strength × weight × max effect × scope × sign             |
| Demographic appeal          | `calcAppeal()` in `src/lib/utils/demographicAppeal.ts`                             | Shared by vote distribution and poll calculations                    |
| NPI normalization           | `normalizeNPI()` in `src/lib/utils/normalizeNPI.ts`                                | Sqrt political influence scaling, capped at 1.0 once PI/NPI ≥ 100    |
| Country config              | `getCountryConfig()` in `src/lib/constants/countries.ts`                           | Never hardcode `"US"`, `"UK"`, etc.                                  |
| Party org constants         | `src/lib/constants/partyOrg.ts`                                                    | Momentum rates, cap weights, election bonuses                        |

## Anti-patterns

### Don't: Extract a generic `clamp(value, min, max)`

The inline `Math.max(min, Math.min(max, value))` pattern appears 30+ times with domain-specific bounds. A generic clamp would:

- Hide what the bounds are (are we clamping approval? momentum? metrics?)
- Not actually reduce bugs (the pattern itself never breaks; wrong bounds do)
- Add an import for a one-liner

### Don't: Unify policy option lookups

`billEnactment.ts`, `policyEffects.ts`, and `billEnrichment.ts` each look up policy options with intentionally different fallback chains. A shared `findPolicyOption()` would need mode flags that obscure what each caller actually wants.

### Don't: Extract "threshold calculation" helpers

The `Math.ceil((2/3) * seats)` pattern for veto overrides appears in federal and state bill lifecycle with different chamber structures. The federal version counts House and Senate independently; the state version uses a single chamber. A shared helper would need flags for this distinction.

### Don't: Create a generic "lifecycle phase" abstraction

Elections, bills, and campaigns all have phase transitions, but the states, triggers, and side effects differ fundamentally. A shared `LifecycleManager<T>` would add indirection without clarifying any individual system.

## Adding new reuse

When you identify a candidate for extraction:

1. **Verify it's used identically in 2+ places** (search the codebase, don't assume).
2. **Name it after the domain concept**, not the implementation (`calculateComplianceChance`, not `weightedAverage`).
3. **Place it in the module closest to its consumers** (e.g., NPP voting logic stays in `src/lib/turn/npp/`, not `src/lib/utils/`).
4. **Add a test file** next to the extracted function.
5. **Update this document** with the new canonical location.
6. **Update all call sites** — don't leave orphaned inline copies.

## Audit log

| Date       | Change                                                         | Files affected                                                 |
| ---------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| 2026-03-23 | Extracted `resolveWhipForNPP` from bill/leadership voting      | `whipResolution.ts`, `billVoting.ts`, `leadershipVoting.ts`    |
| 2026-03-23 | Consolidated `alignmentScore` and leadership constants         | `speakerRecalculation.ts` → imports from `leadershipVoting.ts` |
| 2026-03-23 | Used `calculateComplianceChance` in leadership whip resolution | `leadershipVoting.ts` → imports from `nppVoteLogic.ts`         |
