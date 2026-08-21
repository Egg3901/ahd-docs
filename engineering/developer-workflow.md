# Developer workflow (local)

> Daily setup, commands, and conventions for contributors and AI-assisted sessions on **A House Divided**.
> Last updated: 2026-08-21

For codebase structure, see [repo-operating-map.md](./repo-operating-map.md). The authoritative rules for code and git live in `AGENTS.md` at the app repo root.

---

## 1. Prerequisites

| Requirement     | Notes                                        |
| --------------- | -------------------------------------------- |
| Node.js **20+** | Declared in `package.json` → `engines.node`  |
| npm **10+**     | Used by CI (`.github/workflows/ci.yml`)      |
| MongoDB         | Local instance or Atlas; URI in `.env.local` |

---

## 2. First-time setup

Commands (from repository root):

```bash
npm ci
cp .env.example .env.local
```

Edit **`.env.local`** with at least:

- `MONGODB_URI` or its supported `MONGO_URL` alias, e.g. `mongodb://localhost:27017/a-house-divided`
- `AUTH_SECRET`, JWT signing secret
- `ADMIN_REGISTRATION_KEY`, admin registration
- `CRON_SECRET`, protects cron routes

Optional variables are documented in `.env.example` (Discord OAuth, Blob, Sentry, GitHub issue creation, etc.).

Bootstrap a complete playable world:

```bash
npm run bootstrap:full
```

`npm run seed` only installs the US reference core. `npm run seed:all` layers several legacy seed scripts but is not the full multi-country world bootstrap. Use those only when the task specifically targets their narrower contracts.

Then start the app:

```bash
npm run dev
```

Development startup auto-seeds reference data and starts the in-process turn scheduler. Set `DISABLE_DEV_BACKGROUND=1` when you need a quiet server for tests, migrations, or documentation work.

To build and run the production bundle locally:

```bash
npm run verify:build
npm run start
```

---

## 3. Package scripts (reference)

Defined in `package.json` (a-house-divided app repo) `scripts` section. High-signal entries:

| Script                                     | Purpose                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `dev`                                      | Next.js dev server (`next dev`)                                               |
| `build` / `start`                          | Production build and server                                                   |
| `lint`                                     | ESLint (flat config: `eslint.config.mjs`)                                     |
| `format` / `format:check`                  | Prettier write / check                                                        |
| `typecheck`                                | `tsc --noEmit`, same as CI type-check step                                    |
| `test`                                     | Vitest **watch** mode                                                         |
| `test:run`                                 | Vitest **single run**, default for CI-equivalent test runs without coverage   |
| `test:coverage`                            | `vitest run --coverage`, matches CI test step                                 |
| `verify` / `verify:serial`                 | Parallel or serial lint, format, type, architecture, and unit-test gate       |
| `verify:build`                             | Next.js production build                                                      |
| `test:e2e`                                 | Playwright (`playwright.config.ts`); local use assumes a running app (see §6) |
| `bootstrap:full`, `bootstrap:vacant`       | Complete authored world bootstrap, with historical or vacant officials        |
| `seed`, `seed:reset`, `seed:all`, `seed:*` | Narrow reference and domain-specific seed contracts                           |

Niche utilities (use when needed, not part of the daily loop): `simulate`, `migrate:*`. (The legacy `quality:assess` script was retired 2026-05-19, its functionality is covered by `lint` + `typecheck` + `test:run` + the `scripts/audit/` suite.)

---

## 4. Alignment with CI

GitHub Actions workflow: `.github/workflows/ci.yml` (a-house-divided app repo).

| CI step            | Local equivalent                    |
| ------------------ | ----------------------------------- |
| Lint               | `npm run lint`                      |
| Format             | `npm run format:check`              |
| Type-check         | `npx tsc --noEmit -p tsconfig.json` |
| Architecture audit | `npm run architecture:audit`        |
| Unit tests         | `npm run test:run`                  |
| Build              | `npm run verify:build`              |

**`verify`** matches the local quality gate: lint, format check, typecheck, architecture audit, then `test:run`. CI does not run `npm audit` or `test:coverage`; use `test:coverage` locally only when you need coverage numbers.

---

## 5. Recommended daily workflow

### Humans

1. `git fetch` and branch from **`development`** (see `AGENTS.md`, feature → development → staging → main).
2. Implement changes; keep scope tight.
3. Before commit or push: `npm run verify`.
4. If you touched release-facing behavior, update `CHANGELOG.md` per project conventions.
5. Husky runs **lint-staged** on commit (see `package.json` → `lint-staged`); it does not replace full-repo `verify`.

### AI-assisted sessions

1. Read `AGENTS.md` and [repo-operating-map.md](./repo-operating-map.md).
2. Use `npm run verify` as the standard done check.
3. Use `npm run verify:build` when changing anything that could affect the production bundle, Next.js routing, server/client boundaries, or build-time imports.

---

## 6. End-to-end tests (Playwright)

- Config: `playwright.config.ts` (a-house-divided app repo).
- **Local:** start the app (`npm run dev` or `npm run build && npm run start`), then `npm run test:e2e` in another terminal.
- **Credentials:** optional `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` in `.env.local`, see `e2e/README.md` (in the a-house-divided app repo).
- **Browsers:** first run may need `npx playwright install`.
- When `CI=true`, Playwright can start the server via `build` + `start` (see `webServer` in the config).

---

## 7. Common pain points

| Issue                                                                                              | Mitigation                                                           |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| README / docs referenced `typecheck` but script was missing                                        | Resolved: `npm run typecheck` in `package.json`                      |
| Contributing text said “branch off `main`” while `AGENTS.md` uses **development / staging / main** | README Contributing updated; this doc repeats the three-branch model |
| Playwright CI `webServer` used a non-existent `start:frontend` script                              | Use `npm run start` (Next production server)                         |

---

## 8. Deferred / out of scope

- **ESLint target:** `npm run lint` invokes `eslint` with project defaults; if the repo has warnings/errors outside your change, fix them when touched or track separately.
- **`npm audit`:** network-dependent and policy-sensitive; run intentionally rather than in every `verify`.
- **E2E in CI:** the main CI workflow is unit/integration focused; E2E is documented for local and optional CI secrets (see `e2e/README.md`).
