# Module boundaries and layering

This document describes how the A House Divided codebase is structured **in practice**: where simulation logic lives, how HTTP and UI relate to it, and rules that keep cross-cutting changes safe. It complements [`repo-operating-map.md`](./repo-operating-map.md) (physical layout) and [`../design/technical-architecture.md`](../design/technical-architecture.md) (request flow and stack).

---

## 1. Intended layers (as implemented)

| Layer                       | Location                                      | Responsibility                                                                                                                                                                                     |
| --------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HTTP surface**            | `src/app/api/**/route.ts`                     | Auth (`requireAuth`, `requireAdmin`, …), request validation (Zod), HTTP status codes, calling domain functions. Should not embed multi-step simulation rules inline.                               |
| **Domain / simulation**     | `src/lib/**` (excluding `src/lib/api/`)       | Game rules, turn phases, DB access via `getDb()`, cross-collection workflows. This is the default home for behavior.                                                                               |
| **Turn orchestration**      | `src/lib/turnSystem.ts`, `src/lib/cron.ts`    | Sequences phases; exports `processTurn`, `getGameState`, and selected re-exports used by admin/cron routes.                                                                                        |
| **Turn phases**             | `src/lib/turn/**`                             | Hourly mutations: elections, NPP, party org processing, bonds, etc. Imports **must not** be required from React components when the dependency is only **numeric config** shared with UI (see §4). |
| **Persistence types**       | `src/lib/db/types/**`                         | MongoDB document shapes; imported everywhere (API, `lib`, server components).                                                                                                                      |
| **HTTP helpers**            | `src/lib/api/**`                              | Auth guards, `parseJsonBody`, `handleRouteError`, rate limits, shared Zod schemas. **Not** game rules.                                                                                             |
| **Country configuration**   | `src/lib/constants/countries.ts`              | Single source for country-specific rules and labels; enforced with `no-country-literals` ESLint rule.                                                                                              |
| **Presentation**            | `src/app/**` (pages), `src/components/**`     | Renders data; client components fetch via HTTP.                                                                                                                                                    |
| **Cross-runtime constants** | `shared/constants/**`, `src/lib/constants/**` | Values needed by scripts **and** app (`shared/`), or app-only tunables and labels (`src/lib/constants/`).                                                                                          |

There is **no separate backend repo**: Next.js route handlers are the API. “Use case” boundaries are expressed by **which `src/lib` module** a route imports, not by a separate service layer.

---

## 2. Dependency rules (normative)

1. **`src/lib/api/*` does not import turn phases** (`src/lib/turn/**`) for business logic. It may only import types or pure utilities if ever needed; prefer keeping API helpers free of simulation.

2. **Routes may call domain modules**, including `processTurn` from `turnSystem`, `getGameState`, and functions under `src/lib/turn/*` when the endpoint’s job is to run or expose that logic (admin tools, cron, player actions that mirror turn rules). That is **not** a layering violation; duplicating the same rules inside the route **would** be.

3. **UI and shared display logic** should not import from `src/lib/turn/**` **for tunable constants** that also appear in the turn engine. Those belong in `src/lib/constants/` (or `shared/` when scripts need them). Turn modules may re-export or import from the same constants module so phase code and UI stay aligned.

4. **`src/components/*`** may import from `src/lib/db/types`, `src/lib/constants/*`, `src/lib/utils/*`, `src/lib/seeds/*` (read-only reference data), and similar **non-turn** modules. Importing **behavior** from `src/lib/turn/*` in a component is a red flag, move the behavior behind an API route or into a neutral `src/lib` helper.

5. **Scripts** (`scripts/`) use `connectDb()` from `scripts/utils/db.ts`, not `getDb()`, but may import shared constants from `src/lib/constants/` or `shared/` to match production formulas.

---

## 3. Actual boundary issues observed (audit snapshot)

### 3.1 Simulation helpers in routes (acceptable when intentional)

Many routes import `getGameState` from `@/lib/gameState` (e.g. `src/app/api/unions/[id]/route.ts`, several `src/app/api/admin/**` routes). `turnSystem.ts` also re-exports `getGameState` for `cron.ts`. That ties “current turn” reads to a canonical read helper. **This is acceptable**: `getGameState` is the canonical read of `GameState` and is lightweight compared to `processTurn`.

Routes that invoke **phase logic** (e.g. `src/app/api/admin/elections/[id]/resolve/route.ts` importing `resolveGeneralElections` from `@/lib/turn/electionResolution`) are **admin-only repair/trigger** endpoints; they intentionally reuse the same functions as the hourly loop.

### 3.2 `getGameState` now lives in its own module

`getGameState` is defined in `src/lib/gameState.ts` (not `turnSystem.ts`). Files such as `src/lib/billLifecycle.ts` import it directly from `@/lib/gameState`, avoiding a dependency on the turn orchestrator module. `turnSystem.ts` imports it from `@/lib/gameState` and re-exports it for `cron.ts`. There is no `src/lib/stateBillLifecycle.ts` in the codebase.

### 3.3 Dumping-ground and naming collisions

Documented in [`repo-operating-map.md`](./repo-operating-map.md) §3: dual seed locations (`scripts/seeds/` vs `src/lib/seeds/`), `shared/constants/` vs `src/lib/constants/`, and similar directory pairs (`electionEngine` vs `elections`). Use the operating map’s “Where things live” table when adding files.

### 3.4 Circular imports

The codebase relies on TypeScript and careful barrel files. No systematic circular-dependency tooling is enforced in CI. If a new `index.ts` re-exports both high-level and low-level modules, watch for cycles, prefer **direct imports** to ambiguous barrels in hot paths.

---

## 4. Implemented cleanup: party org constants

**Before:** Several UI files under `src/app/state/.../party/...` and API routes imported tunable numbers from `@/lib/turn/partyOrg/constants`, coupling presentation to the **turn package path**.

**After:** Definitions live in `src/lib/constants/partyOrg.ts`. `src/lib/turn/partyOrg/constants.ts` re-exports them for existing `import ... from "./constants"` usage inside `partyOrg/`. UI and routes import `@/lib/constants/partyOrg`.

**Symbols:** `CAP_BASE`, `CAP_WEIGHTS`, `CYCLE_TURNS`, `MOMENTUM_*`, `ORG_PER_MOMENTUM`, `DOLLARS_PER_MOMENTUM`, `MOMENTUM_WIN`, etc.

---

## 5. Checklist for contributors and AI sessions

- [ ] Changing hourly behavior? Read the relevant design doc in the ops-knowledge MCP and the phase registry order in `src/simulation/phases/turnPhaseRegistry.ts`.
- [ ] Changing country rules? Use `getCountryConfig` / `CountryConfig` in `src/lib/constants/countries.ts`, not string literals.
- [ ] Adding an API route? Follow `docs/design/api-conventions.md` and `src/lib/api/*` patterns.
- [ ] Adding constants shown in UI **and** used in turn math? Put them in `src/lib/constants/` (or `shared/` if scripts need them); do not add new imports from `src/lib/turn/**` in `components/` unless there is no alternative.
- [ ] Unsure where a file goes? See [`repo-operating-map.md`](./repo-operating-map.md) §5.

---

## 6. Related references

| Topic                           | Location                                                 |
| ------------------------------- | -------------------------------------------------------- |
| Turn phase order and invariants | `claude.md` (Turn System), `docs/design/core-systems.md` |
| API patterns                    | `docs/design/api-conventions.md`, `src/lib/api/`         |
| DB types                        | `src/lib/db/types/`                                      |
| Blast radius tiers              | `docs/engineering/repo-operating-map.md` §2              |
