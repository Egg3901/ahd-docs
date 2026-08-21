# AI Development Workflow for A House Divided

> Shared guide for AI-assisted work in the public AHDGame repository.
> Accuracy pass: 2026-08-21

---

## 1. Before You Start

Every AI session must begin with orientation:

1. **Read `AGENTS.md`** in AHDGame for the repository contract, branch flow, coding standards, and validation requirements.
2. **Read [Repo Operating Map](./repo-operating-map.md)** for the structural map and blast-radius tiers.
3. **Read the relevant design page** on docs.lakesidegames.net before touching a game system. Design and engineering guides are maintained in ahd-docs, not under `AHDGame/docs/design/`.
4. **Check related tasks only when relevant**. Do not mutate external task systems unless the user asks for task tracking or triage.

Do not skip orientation. This is a live multiplayer simulation with many stateful turn phases and collections, not a generic CRUD app. Uninformed changes can silently corrupt game state.

---

## 2. Investigation Phase

### 2.1 How to Investigate

Always investigate before implementing. The goal is to understand the system you're touching, its invariants, and its blast radius.

**Step 1 - Read the design page.** Major systems are documented in ahd-docs. Treat source code as authoritative for shipped behavior and reconcile any discrepancy instead of assuming the page is current.

**Step 2 - Read the code entry point.** Common starting points are:

| System          | Entry point                                                          |
| --------------- | -------------------------------------------------------------------- |
| Elections       | `src/lib/turn/electionResolution.ts`                                 |
| Turn processing | `src/lib/turnSystem.ts`                                              |
| NPP behavior    | `src/lib/turn/nppBehavior.ts`                                        |
| Legislation     | `src/lib/billLifecycle.ts` -> `src/lib/turn/billLifecycle/engine.ts` |
| Demographics    | `src/lib/demographicEffects.ts`                                      |
| Campaigns       | `src/lib/turn/campaignTurn.ts`                                       |
| Country config  | `src/lib/constants/countries.ts`                                     |
| Policy effects  | `src/lib/policyEffects.ts`                                           |

**Step 3 — Trace the data flow.** Identify which collections are read and written. Check `src/lib/db/types/` for the document shapes involved.

**Step 4 — Find existing tests.** Look for `*.test.ts` files co-located with the code. These show expected behavior and edge cases the original author considered.

**Step 5 - Use only available tooling.** The public AHDGame repository does not
ship `.claude/skills/` or `.agents/skills/`. Do not direct contributors to
project-local skills that are absent from their checkout.

### 2.2 Citation Requirements

When reporting investigation findings, always cite:

- **File path and line number** — e.g., `src/lib/turnSystem.ts:142`
- **Function or symbol name** — e.g., `runElectionResolution()`
- **Collection names** — e.g., writes to `electionCandidates`, reads from `elections`
- **Design page** - e.g., "per the Elections design page, primaries must resolve before generals"

Do not make claims about system behavior without pointing to the code or doc that supports them. Vague statements like "the election system handles this" are not acceptable — name the function.

### 2.3 Investigation Output Format

Structure investigation summaries as:

```markdown
## Investigation: [System/Issue Name]

**Files examined:**

- `path/to/file.ts` — [what it does]
- `path/to/other.ts` — [what it does]

**Design page:** `design/relevant-doc.md` in ahd-docs

**Current behavior:**
[What the code actually does, with file:line citations]

**Collections involved:**

- Reads: `collectionA`, `collectionB`
- Writes: `collectionC`

**Invariants found:**

- [Invariant 1 — cite source]
- [Invariant 2 — cite source]

**Risks:**

- [Risk 1]

**Recommendation:**
[What to do next]
```

---

## 3. Implementation Phase

### 3.1 Rules

1. **Follow existing patterns.** Find the nearest similar implementation and match its structure. Don't invent new patterns.
2. **Use required skills.** If your change touches a skill-gated area (see table above), invoke the skill before making changes.
3. **Respect scope control.** Only modify files directly relevant to the task. Do not refactor adjacent code, rename navigation labels, or add new game mechanics without explicit instruction.
4. **No hardcoded country literals.** The custom ESLint rule `no-country-literals` forbids bare country-string comparisons outside approved source-of-truth files and tests. Use `getCountryConfig(countryId)` and other helpers from `src/lib/constants/countries.ts`.
5. **API routes follow the standard pattern.** See [API Route Checklist](./api-route-checklist.md): a suitable `require*` guard, `parseJsonBody()`, domain logic, then `handleRouteError()`.
6. **Next.js 16 params are Promises.** Always `await params` in dynamic route handlers.

### 3.2 High-Risk Change Checklist

Before modifying any Tier 1 or Tier 2 system (see `repo-operating-map.md`), confirm:

- [ ] Read the design doc for this system
- [ ] Identified all collections read/written
- [ ] Checked for cross-collection consistency requirements
- [ ] Verified turn processing order is preserved (if touching `src/lib/turn/`)
- [ ] Confirmed no new hardcoded country literals
- [ ] Found and read existing tests for the area
- [ ] Stated risks explicitly to the user before proceeding

### 3.3 When to Stop Short

Stop and ask the user instead of proceeding when:

- The change would alter turn processing order or phase groupings
- The change introduces a new game mechanic not described in any design doc
- The change modifies election resolution, vote distribution, or NPP decision logic
- You're unsure whether a behavior is intentional or a bug
- The fix requires touching 5+ files across different systems
- The design doc contradicts the code and you don't know which is authoritative

---

## 4. Validation Phase

### 4.1 Mandatory Checks

Every code change should pass the local validation gate before it is considered done:

```bash
npm run verify            # One shot: lint, format:check, typecheck, architecture:audit, test:run
```

Or run the same steps individually (equivalent to the pieces of `verify`):

```bash
npm run typecheck         # tsc --noEmit
npm run lint
npm run format:check
npm run architecture:audit
npm run test:run
```

CI runs lint, formatting, type checking, the advisory architecture audit,
`npm run test:run`, and a separate `npm run verify:build` job. Coverage and
`npm audit` are optional local checks, not current CI steps.

Run `npm run verify` before committing. Run `npm run verify:build` as well when
the change can affect the production bundle, routing, server/client boundaries,
environment handling, or build-time imports.

### 4.2 When Tests Must Be Added

Tests are **required** for:

- New turn processing logic (any file in `src/lib/turn/`)
- Election calculations or vote distribution changes
- NPP behavior changes
- API routes with business logic
- New utility functions with non-trivial logic

Tests are **recommended** for:

- Schema validation changes
- Cross-collection operations

Tests can be **skipped** for:

- Simple UI components without business logic
- Pure layout or styling changes

### 4.3 Test Patterns

Co-locate tests: `something.test.ts` next to `something.ts`.

Use `MockDb` for unit tests:

```ts
import { createMockDb, type MockDb } from "@/lib/test-utils/mockDb";

vi.mock("@/lib/mongodb", () => ({ getDb: vi.fn() }));

let db: MockDb;
beforeEach(async () => {
  db = createMockDb();
  const { getDb } = await import("@/lib/mongodb");
  vi.mocked(getDb).mockResolvedValue(db as unknown as Db);
});
```

For integration tests that need a real DB:

```ts
const skipIfNoDb = !process.env.MONGODB_URI ? describe.skip : describe;
```

---

## 5. Documentation Phase

### 5.1 When Docs Must Be Updated

- **Development changelog** - run `npm run changelog:new -- "Title"` to create a post under `content/changelog/dev/`. Root `CHANGELOG.md` is an index.
- **Player changelog** - use `content/changelog/public/` when player-facing release notes are in scope.
- **Design docs** - update the corresponding ahd-docs page if behavior changes contradict or extend it. Do not create an `AHDGame/docs/design/` mirror.
- **`AGENTS.md`** - update only when repository-wide agent or contributor rules change.

### 5.2 When Docs Should Not Be Updated

- Do not create new markdown files for minor changes
- Do not add README files to directories unless explicitly asked
- Do not document implementation details that are obvious from reading the code

### 5.3 Logging Deferred Work

When you spot an issue that's out of scope:

1. **Log it as a task only if requested**, using whatever task integration is available in the current environment.
2. **Add an inline comment** only if the issue is non-obvious and could mislead future editors
3. **Mention it in your session summary**

Do not silently fix adjacent issues — this causes scope creep.

### 5.4 Lessons Learned

After completing significant tracked work, log what was learned via the task manager only when the user asked for task/lesson tracking or the current task already uses it:

```json
POST /api/admin/tasks/lessons
{
  "lesson": "Bond coupon processing must run after corporationTurn because it reads updated liquidCapital",
  "category": "technical"
}
```

Categories: `bug`, `design`, `process`, `technical`, `general`.

---

## 6. Handling Uncertainty

### Decision tree:

1. **Check the design page** - if ahd-docs covers it, compare the documented intent with current source
2. **Check existing code** — find the nearest similar implementation and match it
3. **Ask the user** — if neither doc nor code clarifies, ask rather than guess
4. **Flag risks** — if proceeding anyway, state the risk explicitly

### What "asking" looks like:

```
I found two possible approaches for [X]:

1. [Approach A] — matches the pattern in `src/lib/turn/campaignTurn.ts:85`
2. [Approach B] - aligns with the Elections design page section on primaries

The design doc and code seem to disagree on [specific point].
Which should I follow?
```

Never silently make design decisions about game mechanics. Wrong guesses compound over hundreds of turns.

---

## 7. Session Handoff

### 7.1 Between AI Sessions

When ending a session or handing off to a new session (same human, different context window):

**Outgoing session must:**

1. Commit completed work only when the user asked for a commit or the workflow requires it
2. Log deferred issues as tasks only when task tracking is in scope
3. Log lessons learned only for tracked work or when requested
4. Provide a summary with:
   - What was completed (with file paths)
   - What was deferred (with task IDs if created)
   - What the next session should tackle first
   - Any risks or open questions

**Incoming session must:**

1. Read `AGENTS.md` and [Repo Operating Map](./repo-operating-map.md)
2. Check external tasks only if continuing explicitly tracked work
3. Review recent git log for context when useful: `git log --oneline -20`
4. Read the handoff summary if provided

### 7.2 Between Humans Using AI

When multiple developers use AI tools on the same repo:

- **Use feature branches.** Never commit directly to `development`, `staging`, or `main`.
- **Keep branches small and focused.** One task per branch.
- **Commit before switching contexts.** Uncommitted work is invisible to the next person.
- **Use the task system when it is in scope.** It persists across sessions and users, but unrelated discoveries should be summarized instead of silently added to the task database.
- **Don't trust AI memory across sessions.** Each new context window starts fresh. The task system, design docs, and code comments are the durable record.

### 7.3 Tool differences

Tool-specific capabilities vary by environment, but the repository contract
does not. Every tool should follow the same investigation, implementation,
validation, and documentation workflow, and should cite source files for claims
about current behavior.

---

## 8. Output Format for Completed Work

When reporting completed work, use this structure:

```markdown
## Summary

### Investigation

- [What was examined, with file:line citations]

### Findings

- [What was discovered, referencing specific files and symbols]

### Changes Made

- `path/to/file.ts` — [what changed and why]

### Validation

- [ ] `tsc --noEmit` — passed
- [ ] `eslint .` — passed
- [ ] `prettier --check .` — passed
- [ ] `test:run` — passed (N tests, N suites)

### Deferred Issues

- [Issue description] — logged as task #[ID] / noted for follow-up

### Risks

- [Any remaining risks or things to monitor]
```

---

## 9. Anti-Patterns

Avoid these common mistakes in AI-assisted development on this repo:

| Anti-pattern                                                | Why it's dangerous                                                         | Do this instead                                                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Editing turn phases without reading the registry            | Phase ordering is an invariant; blind changes break resolution             | Read `src/simulation/phases/turnPhaseRegistry.ts` and trace the orchestrator |
| Using bare country literals in comparisons                  | Custom ESLint rule will reject; pattern doesn't scale                      | Use `getCountryConfig(countryId)` and related helpers                        |
| Adding `as any` casts to fix type errors                    | Hides real bugs that surface at runtime                                    | Fix the actual type mismatch                                                 |
| Fixing "nearby" code while on a different task              | Causes scope creep, makes PRs hard to review                               | Mention it in the summary or log it only when task tracking is in scope      |
| Guessing game rules when the design doc is unclear          | Wrong guesses compound over hundreds of turns                              | Ask the user                                                                 |
| Skipping `npm run test:run` because "it's just a UI change" | UI components can import logic that breaks                                 | Always run the full pipeline                                                 |
| Creating new files instead of editing existing ones         | Causes file bloat, duplicates patterns                                     | Check if an existing file covers the domain                                  |
| Committing without the local validation gate                | Bypasses type checking, linting, formatting, architecture audit, and tests | Run `npm run verify`                                                         |
