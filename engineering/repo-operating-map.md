# Repo Operating Map

> A structural guide to the A House Divided codebase.
> Last updated: 2026-03-23

For naming conventions, confusing directory pairs, and discoverability guidelines, see [`naming-and-organization.md`](./naming-and-organization.md).

> For a fast feature→file lookup (the AI entry point), see [`../CODEBASE_INDEX.md`](../CODEBASE_INDEX.md).

---

## 1. Architectural Zones

### 1.1 App Routes — `src/app/`

Next.js 16 App Router. Every subdirectory is a page route or API route group.

| Sub-path                                                                                                                 | Purpose                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `src/app/api/`                                                                                                           | **API surface** — 70+ route groups covering auth, game, admin, cron, discord-bot, wiki, etc. |
| `src/app/admin/`                                                                                                         | Admin dashboard pages                                                                        |
| `src/app/auth/`, `login/`, `register/`                                                                                   | Authentication flows                                                                         |
| `src/app/dashboard/`                                                                                                     | Player dashboard                                                                             |
| `src/app/state/`, `national/`, `country/`, `world/`                                                                      | Geographic/political views                                                                   |
| `src/app/congress/`, `legislature/`, `executive/`, `whitehouse/`                                                         | Government branch pages                                                                      |
| `src/app/elections/`, `campaign/`                                                                                        | Election and campaign UIs                                                                    |
| `src/app/parties/`, `politicians/`, `officials/`                                                                         | Political actors                                                                             |
| `src/app/corporation/`, `corporations/`, `stockmarket/`, `bond/`, `commodity/`, `central-bank/`, `portfolio/`, `budget/` | Economic systems                                                                             |
| `src/app/wiki/`, `news/`, `changelog/`                                                                                   | Content & information                                                                        |
| `src/app/uk/`                                                                                                            | UK-specific pages                                                                            |
| `src/app/settings/`, `profile/`, `notifications/`                                                                        | User settings                                                                                |
| Root files: `layout.tsx`, `page.tsx`, `globals.css`, `error.tsx`, etc.                                                   | App shell, global styles, error boundaries                                                   |

**Key API sub-groups:**

- `api/admin/` — ~40 admin endpoints (seed, heal, debug, migrations, config, turn control, task management)
- `api/cron/turn/` — Hourly turn processing entry point (Vercel cron)
- `api/discord-bot/` — ~15 Discord bot command endpoints
- `api/auth/` — Login, register, OAuth (Google/Discord), JWT management
- `api/v1/` — Versioned public API (currently just leaderboard)

### 1.2 Shared UI — `src/components/`

React components organized by feature domain.

| Sub-path                                                                                                                                                            | Purpose                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ui/`                                                                                                                                                               | **Primitives** — Button, Input, Label, Skeleton, Toast, ResponsiveTable, etc. (16 files) |
| `admin/`                                                                                                                                                            | Admin panel components                                                                   |
| `budget/`, `charts/`, `demographics/`, `elections/`, `legislation/`, `news/`, `officials/`, `party/`, `state/`, `corporation/`, `governors/`, `influence/`, `wiki/` | Feature-specific component groups                                                        |
| `landing/`                                                                                                                                                          | Landing/marketing page components                                                        |
| `uk/`                                                                                                                                                               | UK-specific components                                                                   |
| `FeedbackModal/`                                                                                                                                                    | User feedback widget                                                                     |

### 1.3 Domain Logic — `src/lib/`

The heart of the server-side codebase. ~60 top-level files plus sub-modules.

| Sub-path                                                                                                                                                                                            | Purpose                                                                      | Blast radius                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| `turnSystem.ts` (665 lines)                                                                                                                                                                         | **Turn orchestrator** — sequences 15 processing phases                       | **CRITICAL** — affects all game state every hour      |
| `cron.ts` (71 lines)                                                                                                                                                                                | Cron entry point, calls turnSystem                                           | **CRITICAL**                                          |
| `turn/` (~55 files)                                                                                                                                                                                 | Individual turn phase implementations                                        | **HIGH** — each phase mutates game state              |
| `db/types/` (~60 type files)                                                                                                                                                                        | MongoDB document type definitions                                            | **HIGH** — schema changes cascade everywhere          |
| `db/collections/`                                                                                                                                                                                   | Typed collection accessors                                                   | Medium                                                |
| `constants/` (~15 files)                                                                                                                                                                            | Country configs, game constants, state data                                  | **HIGH** — countries.ts drives config-based branching |
| `api/` (~35 files)                                                                                                                                                                                  | API helpers: auth guards, validation, schemas, error handling, rate limiting | **HIGH** — auth/validation layer                      |
| `seeds/` (~16 files)                                                                                                                                                                                | Runtime seed data (achievements, demographics, UK data)                      | Medium                                                |
| `election/`, `elections/`                                                                                                                                                                           | Election logic helpers                                                       | HIGH                                                  |
| `actions.ts`                                                                                                                                                                                        | Player action system                                                         | HIGH                                                  |
| `auth.ts`                                                                                                                                                                                           | JWT authentication (`getAuthUser`, `getAuthUserWithCharacter`)               | **CRITICAL**                                          |
| `mongodb.ts`                                                                                                                                                                                        | Database connection (`getDb()`)                                              | **CRITICAL**                                          |
| `billLifecycle.ts`, `billEnactment.ts`, `billVoteLogic.ts`                                                                                                                                          | Legislation pipeline                                                         | HIGH                                                  |
| `nationalMetrics.ts`, `demographicEffects.ts`, `policyEffects.ts`                                                                                                                                   | Simulation effects                                                           | HIGH                                                  |
| `electionEngine.ts`, `presidentialElectionEngine.ts`                                                                                                                                                | Election resolution                                                          | HIGH                                                  |
| `discord.ts`, `discord-client.ts`, `discordWebhooks.ts`                                                                                                                                             | Discord integration                                                          | Medium                                                |
| `news.ts`, `notifications.ts`, `events.ts`                                                                                                                                                          | Communication systems                                                        | Medium                                                |
| `__tests__/`                                                                                                                                                                                        | Integration tests (phase1-3, country parameterized, discord)                 | Low                                                   |
| Other: `npp/`, `bonds/`, `budget/`, `campaigns/`, `congress/`, `influence/`, `seats/`, `states/`, `map/`, `wiki/`, `charts/`, `commodity-map/`, `data/`, `hooks/`, `time/`, `utils/`, `test-utils/` | Supporting domain modules                                                    | Varies                                                |

### 1.4 Client-Side Hooks — `src/hooks/`

8 custom React hooks: `useAsyncData`, `useDebounce`, `useGameEvents`, `useImageUpload`, `useIsAdmin`, `usePaginatedFetch`, `useTickerDecel`, `useWikiEditorState`.

### 1.5 Contexts — `src/contexts/`

3 React context providers: `FeedbackContext`, `ThemeContext`, `ToastContext`.

### 1.6 Shared Types — `src/typings/`

Only 2 files — ambient type declarations for `d3-geo` and `react-simple-maps`. Most types live in `src/lib/db/types/`.

### 1.7 Static Data — `src/data/`

GeoJSON files for congressional districts and counties. Used by the map system.

### 1.8 Scripts — `scripts/`

Database scripts, seeds, migrations, audits, and debug utilities.

| Sub-path                                 | Purpose                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `seed.ts`, `seed-*.ts`, `seedBudgets.ts` | Database seeding (idempotent)                                                |
| `seeds/` (~25 files)                     | Seed data organized by country (US, UK, CA, DE)                              |
| `migrations/`                            | Database migrations                                                          |
| `audit/`                                 | Automated audit suites (25 test suites across elections, demographics, etc.) |
| `archive/`                               | Retired scripts and migrations                                               |
| `utils/db.ts`                            | Script-specific DB connection (`connectDb()`/`closeDb()`)                    |
| Root `.ts`/`.js` files                   | One-off utilities (simulate, verify, check, fix)                             |

### 1.9 Tests

| Location                                                   | Framework  | Purpose                                                                                                   |
| ---------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| `*.test.ts` / `*.integration.test.ts` co-located in `src/` | Vitest     | Unit and integration tests, co-located with code they test (~104 test files, 761+ tests)                  |
| `src/lib/__tests__/`                                       | Vitest     | Cross-cutting integration tests (phase-level, country-parameterized) that don't belong to a single module |
| `e2e/`                                                     | Playwright | E2E tests (smoke, critical-flows, performance)                                                            |

### 1.10 Docs

| Sub-path                             | Purpose                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `docs/design/`                       | **30+ design documents** — the canonical spec for every game system                          |
| `docs/engineering/`                  | Engineering guides (this file, [`architecture-boundaries.md`](./architecture-boundaries.md)) |
| the design archive                        | Implementation plans with archive of completed work                                          |
| `docs/superpowers/plans/` + `specs/` | Recent feature plans and design specs                                                        |
| `docs/audits/`                       | System audits (alpha, performance, theme, elections)                                         |
| `docs/archive/wiki-content/`         | Archived wiki content (migrated to DB)                                                       |
| `docs/discord-bot-*.md`              | Discord bot command documentation                                                            |

### 1.11 Configuration & Tooling

| File/Dir                                                                                                  | Purpose                                                     |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `claude.md`                                                                                               | Claude Code rules and project conventions                   |
| `AGENTS.md`                                                                                               | Cursor Cloud / agent-specific setup instructions            |
| `.claude/skills/`                                                                                         | 11 Claude Code custom skills                                |
| `eslint-rules/no-country-literals.js`                                                                     | Custom ESLint rule preventing hardcoded country IDs         |
| `eslint.config.mjs`                                                                                       | ESLint config                                               |
| `.husky/`                                                                                                 | Git hooks (pre-commit: lint-staged; commit-msg: commitlint) |
| `commitlint.config.mjs`                                                                                   | Conventional commit enforcement                             |
| `.prettierrc` / `.prettierignore`                                                                         | Prettier config                                             |
| `tsconfig.json`                                                                                           | TypeScript config                                           |
| `next.config.ts`                                                                                          | Next.js config                                              |
| `vitest.config.ts`                                                                                        | Vitest config                                               |
| `playwright.config.ts`                                                                                    | Playwright config                                           |
| `vercel.json`                                                                                             | Vercel deployment config (cron schedules)                   |
| `instrumentation.ts`, `src/instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` | Sentry error tracking                                       |
| `.env.example`                                                                                            | Environment variable template                               |
| `.github/workflows/`, `dependabot.yml`                                                                    | CI/CD and dependency updates                                |
| `shared/constants/`                                                                                       | Cross-boundary shared constants (formulas, legislation)     |

### 1.12 Root Loose Files

| File                  | Status                                                      |
| --------------------- | ----------------------------------------------------------- |
| `CHANGELOG.md`        | Internal changelog (semver, currently 0.1.1)                |
| `PUBLIC_CHANGELOG.md` | Player-facing changelog                                     |
| `CURSOR_CLOUD.md`     | Cursor Cloud environment setup (MongoDB, env vars, gotchas) |
| `README.md`           | Repository README                                           |

---

## 2. High-Blast-Radius Areas

These areas should **never** be edited casually. Changes require understanding ordering assumptions, idempotency guarantees, and downstream effects.

### Tier 1 — CRITICAL (single-point-of-failure or security boundary)

| Area                    | Files                                                                                                        | Why                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **Turn orchestrator**   | `src/lib/turnSystem.ts`, `src/lib/cron.ts`                                                                   | Sequences all 15 turn phases. Phase ordering is an invariant. Error isolation via try/catch per phase. |
| **Authentication**      | `src/lib/auth.ts`, `src/lib/api/requireAdmin.ts`, `src/lib/api/requireAuth.ts`, `src/lib/api/requireCron.ts` | JWT auth, admin gates, cron auth. Bugs = security holes or lockouts.                                   |
| **Database connection** | `src/lib/mongodb.ts`                                                                                         | Single connection pool. Misconfiguration = total outage.                                               |
| **Country config**      | `src/lib/constants/countries.ts`                                                                             | Drives config-based country branching across the entire codebase. Custom ESLint rule enforces usage.   |

### Tier 2 — HIGH (broad game-state or data-integrity impact)

| Area                           | Files                                                                                                      | Why                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Turn phases**                | `src/lib/turn/*` (55 files)                                                                                | Each phase mutates live game state. Bugs corrupt data for all players.       |
| **Election engines**           | `src/lib/electionEngine.ts`, `src/lib/presidentialElectionEngine.ts`, `src/lib/turn/electionResolution.ts` | Election outcomes affect player positions, government composition.           |
| **DB type definitions**        | `src/lib/db/types/*` (60 files)                                                                            | Schema changes cascade to API routes, turn phases, and UI.                   |
| **API validation layer**       | `src/lib/api/validate.ts`, `src/lib/api/errors.ts`, `src/lib/api/schemas/*`                                | Shared validation. Changes affect many routes.                               |
| **Legislation pipeline**       | `src/lib/billLifecycle.ts`, `src/lib/billEnactment.ts`, `src/lib/legislationEffects.ts`                    | Bills flow through multiple stages with real game-state effects.             |
| **Demographic/policy effects** | `src/lib/demographicEffects.ts`, `src/lib/policyEffects.ts`, `src/lib/nationalMetrics.ts`                  | Simulation core — drives national metrics, approval, demographics each turn. |
| **Seed data**                  | `scripts/seeds/*`, `src/lib/seeds/*`                                                                       | Seeds initialize game state. Wrong data = broken game from turn 0.           |

### Tier 3 — MEDIUM (feature-scoped but still sensitive)

Player actions (`src/lib/actions.ts`), campaign processing (`src/lib/turn/campaignTurn.ts`), NPP behavior (`src/lib/turn/nppBehavior.ts`), party org (`src/lib/turn/partyOrg/`), bond/commodity systems, Discord integration.

---

## 3. Structural Pain Points

### P1 — High priority (actively causes confusion)

1. **Dual seed locations.** Seed data lives in both `scripts/seeds/` (25 files, run by `scripts/seed*.ts`) and `src/lib/seeds/` (16 files, imported at runtime). No clear boundary for which goes where. The `scripts/seeds/` files are for DB seeding scripts; `src/lib/seeds/` files are for runtime seed-data constants and helpers — but this is not documented.

2. **Dual plan locations.** Plans live in both `plans/` (root, 3 files) and the design archive (large archive) and `docs/superpowers/plans/` (recent work). It's unclear which is canonical for active work.

3. **Stale root-level debug files.** ~~`check-min-wage.js` and `test-uk-filter.js` at repo root~~ → Resolved: archived in `scripts/archive/debug/`.

4. **`shared/constants/` vs `src/lib/constants/`** — Two separate constants locations. `shared/constants/` has 3 files (`formulas.ts`, `index.ts`, `legislation.ts`) while `src/lib/constants/` holds app-side tunables and labels (including `partyOrg.ts` for party-org cap/momentum numbers shared by turn phases and UI). **`shared/`**: values needed by **both** `scripts/` and `src/` (e.g. legislation formulas). **`src/lib/constants/`**: app-only configuration and numbers not required by standalone scripts. See [`architecture-boundaries.md`](./architecture-boundaries.md) §1 and §4.

5. **`src/lib/electionEngine/` vs `src/lib/elections/`** — Two similarly-named directories for election logic. See [`naming-and-organization.md`](./naming-and-organization.md) §3.1 for the distinction.

6. **`src/app/corporation/` vs `src/app/corporations/`** — Intentional: list page (`/corporations`) vs detail (`/corporation/[id]`). See [`naming-and-organization.md`](./naming-and-organization.md) §3.2.

### P2 — Medium priority (could confuse new contributors)

7. **`src/typings/`** — Renamed from `src/types/` to clarify these are ambient `.d.ts` declarations for untyped libraries, not domain types (which live in `src/lib/db/types/`).

8. **Integration tests** — `tests/integration/` removed (orphan moved to co-located). Convention: co-locate tests with the code they test; use `src/lib/__tests__/` only for cross-cutting phase-level tests.

9. **`src/lib/hooks/` collision** — Resolved. All React hooks consolidated into `src/hooks/`. `src/lib/hooks/` removed.

10. **Doc sprawl across `docs/design/`, the design archive, `docs/superpowers/`, `docs/audits/`, `docs/archive/`.** No index or guide explaining the doc structure.

11. **Root instruction files** — Consolidated to `claude.md` (AI agent rules + contributor guidelines) and `CURSOR_CLOUD.md` (environment setup). `INSTRUCTIONS.md` merged into `claude.md`.

### P3 — Low priority (cosmetic or minor)

12. **Inconsistent seed script naming.** `seedBudgets.ts` (camelCase) vs `seed-demographics.ts` (kebab-case) vs `seed.ts` (bare).

13. **`src/lib/constants.ts`** (singular, top-level) coexists with `src/lib/constants/` (directory). The singular file likely pre-dates the directory.

---

## 4. Zone Ownership Summary

| Zone                                         | Primary audience | Edit frequency | Review requirement                                     |
| -------------------------------------------- | ---------------- | -------------- | ------------------------------------------------------ |
| `src/lib/turnSystem.ts`, `src/lib/cron.ts`   | Core engine      | Rare           | Must use `ahd-turn-system` skill                       |
| `src/lib/turn/*`                             | Core engine      | Moderate       | Must use `ahd-turn-system` skill                       |
| `src/lib/constants/countries.ts`             | Config           | Moderate       | Must use `ahd-country-system` skill                    |
| `src/lib/auth.ts`, `src/lib/api/require*.ts` | Auth/security    | Rare           | Must use `ahd-security-audit` skill                    |
| `src/lib/db/types/*`                         | Schema           | Moderate       | Type changes need cascade analysis                     |
| `src/app/api/*`                              | API routes       | Frequent       | Must use `ahd-api-route` skill for new/modified routes |
| `src/components/*`                           | UI               | Frequent       | Must use `ahd-design-system` skill                     |
| `scripts/seeds/*`                            | Data             | Occasional     | Review for correctness of constants                    |
| `docs/design/*`                              | Design specs     | Occasional     | Read before implementing; do not contradict            |

---

## 5. Quick Reference: Where Things Live

| If you need to...       | Go to...                                                              |
| ----------------------- | --------------------------------------------------------------------- |
| Add a new API endpoint  | `src/app/api/<group>/route.ts`                                        |
| Add a new page          | `src/app/<route>/page.tsx`                                            |
| Add a new turn phase    | `src/lib/turn/` + register in `src/lib/turnSystem.ts`                 |
| Add a DB type           | `src/lib/db/types/`                                                   |
| Add a country config    | `src/lib/constants/countries.ts`                                      |
| Add a UI primitive      | `src/components/ui/`                                                  |
| Add a feature component | `src/components/<feature>/`                                           |
| Add a Zod schema        | Inline in route file, or `src/lib/api/schemas/` if shared             |
| Add a seed script       | `scripts/seeds/` (DB seeding) or `src/lib/seeds/` (runtime constants) |
| Add a test              | Co-locate as `*.test.ts` next to source                               |
| Add a design doc        | `docs/design/`                                                        |
| Add a plan              | `docs/superpowers/plans/` (current convention)                        |
| Add a custom skill      | `.claude/skills/`                                                     |
| Run the game turn       | `POST /api/cron/turn` (requires CRON_SECRET)                          |
