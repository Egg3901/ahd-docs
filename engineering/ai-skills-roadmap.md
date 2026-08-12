# AI Skills & Playbooks Roadmap

> Audit of reusable AI skills for the A House Divided repository.
> Created 2026-03-23. Updated 2026-05-12 after skill-behavior cleanup.

## Executive Summary

The repo has 13 tracked Claude skills in `.claude/skills/` and one
Codex-visible project skill in `.agents/skills/`. The current priority is not
more skills; it is keeping existing skills source-of-truth driven, low-ceremony,
and aligned with actual package scripts and architecture.

The most important maintenance rule: skills should point agents to authoritative
code and commands instead of copying mutable lists, phase tables, country sets,
or formulas.

## Current Inventory

### Active Skills (`.claude/skills/`)

| Skill                   | Covers                                                                | Maintenance note                                                               |
| ----------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `ahd-api-route`         | API route auth, validation, dynamic params, ObjectId handling, errors | Keep aligned with route helpers and Next.js handler patterns.                  |
| `ahd-centralbank`       | Country economy and central bank analysis                             | Must read current formulas before citing constants; no default live DB access. |
| `ahd-commit`            | Local validation and intentional staging before commit                | Keep in sync with `.agents/skills/ahd-commit` and `package.json` scripts.      |
| `ahd-country-system`    | Config-driven country logic                                           | Derive from `COUNTRY_CONFIGS`/`COUNTRY_ORDER`; do not copy country lists.      |
| `ahd-design-review`     | Implementation vs design-doc review                                   | Questions are optional and only useful when design choices are open.           |
| `ahd-design-system`     | UI tokens, shared components, layout conventions                      | Avoid rigid page mandates; follow existing page patterns.                      |
| `ahd-housekeeping`      | Directory cleanup, archival, gitignore audits                         | Discovery-first; no hardcoded stale-file inventories.                          |
| `ahd-legislation-audit` | Legislation seed validation and fixes                                 | Active seed source is `src/lib/seeds/reference/`.                              |
| `ahd-release`           | Version bumps, changelogs, public notes, design docs                  | Version bump only on explicit user request.                                    |
| `ahd-security-audit`    | Auth, authorization, validation, data leakage, rate limits            | `src/proxy.ts` is not an auth fallback; route guards still matter.             |
| `ahd-task-manager`      | Task API operations and lessons                                       | Explicit-trigger only; no session-start polling or automatic lesson logging.   |
| `ahd-test-patterns`     | Vitest, MockDb, pure/integration test patterns                        | Keep examples close to current `createMockDb` behavior.                        |
| `ahd-turn-system`       | Turn processor and phase registry                                     | `src/simulation/phases/turnPhaseRegistry.ts` is the phase-order source.        |

### Codex-Visible Skills (`.agents/skills/`)

| Skill        | Covers                                                        | Maintenance note                                                          |
| ------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `ahd-commit` | Same local validation and commit behavior as the Claude skill | Keep byte-for-byte equivalent in spirit with `.claude/skills/ahd-commit`. |

### Prompt Templates (`docs/engineering/prompts/`)

Prompt templates are lightweight wrappers for humans or editors without skill
loading. They should reference skills but not duplicate mutable source-of-truth
details.

## Quality Criteria

Every project skill should pass these checks:

1. **Recurrence:** The workflow happens often enough to justify a skill.
2. **Pattern:** The skill describes a repeatable procedure, not one-off domain
   knowledge.
3. **Error prevention:** It prevents mistakes that have actually occurred or are
   high-impact.
4. **Source-of-truth:** Mutable facts come from code, package scripts, or docs
   named by the skill.
5. **Ceremony:** The skill saves more time and risk than it costs to follow.
6. **Permission safety:** It does not silently access live data, secrets, task
   APIs, or external services.

## Maintenance Rules

- Review skills after major country, turn-system, API, or release-process
  changes.
- Prefer "read this source file" over copying country lists, formula constants,
  route counts, or phase order.
- Retire or simplify skills that mostly add process without reducing risk.
- Keep `.agents/skills/ahd-commit` and `.claude/skills/ahd-commit` aligned.
- When a prompt template duplicates a skill, update both or remove the duplicate
  detail from the prompt.

## Candidates To Avoid

Do not create skills for:

- One-off audits and migrations.
- Individual game mechanic decisions better handled in design docs.
- Generic bug fixing beyond the existing investigation prompts.
- Feature-specific implementation where local code and design docs are more
  accurate than a playbook.
