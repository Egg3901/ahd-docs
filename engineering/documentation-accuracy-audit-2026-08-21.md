# Documentation Accuracy Audit, 2026-08-21

## Purpose

This record captures the documentation and seeded-wiki fact check against the A House Divided implementation. It is an audit trail, not a second source of truth. When this file conflicts with code, the named implementation source wins.

## Method

The review used four Cursor Grok subagents for independent country, engineering/API, economy, and wiki-navigation passes, followed by a separate review of the combined diff. Every accepted correction was checked against repository code, tests, schemas, route files, or generated configuration. Claims that described an older design but were still useful were labeled as historical instead of being presented as current behavior.

## Primary implementation sources checked

- Country and office configuration: `src/lib/constants/countries.ts`, `src/lib/constants/states.ts`
- Election allocation and timing: `src/lib/turn/election/`, `src/lib/constants/elections.ts`
- Parliamentary government and Cabinet: `src/lib/turn/parliamentaryGovernment.ts`, `src/lib/government/`, `src/lib/turn/billLifecycle/configs/`
- Economy and fiscal pipeline: `src/lib/turn/`, `src/lib/budget/`, `src/lib/metricEngine/`
- Corporations and markets: `src/lib/corporations/`, `src/lib/turn/corporation/`, `src/lib/currency/`, `src/lib/imf/`
- Sovereign debt and crisis resolution: `src/lib/sovereignDefault/`, `src/lib/bonds/sovereign.ts`
- Public routes and request contracts: `src/app/api/`, `src/app/country/`, `src/app/wiki/`
- Wiki registration and navigation: `src/lib/seeds/wiki/`, `src/lib/wiki/learningPaths.ts`, `src/lib/wiki/redirects.ts`

## Material corrections

### Countries and government

- Corrected UK regional Commons allocation, era-aware seat maps, government formation, Cabinet appointment, and referendum coverage.
- Corrected Germany's mixed-member allocation, Japan's Hare allocation and regional offices, and China's one-party state, NPC, revenue, and office model.
- Replaced two-country parliamentary assumptions with the shared country-configured government-formation model.

### Economy

- Separated per-turn fiscal-base growth and treasury accrual from fiscal-year reconciliation.
- Distinguished corporate IMF restructuring from the sovereign IMF facility.
- Corrected native-currency storage, spread-fee routing, command-economy behavior, resources, commodities, subsidiaries, and sovereign-bond claims.
- Added household demand and price-level coverage to the player wiki.

### Engineering and API guidance

- Updated framework versions, repository paths, branch workflow, CI commands, auth guards, error handling, and MongoDB access guidance.
- Marked inventories, roadmaps, and implementation audits as historical where their value is chronological rather than operational.
- Removed static file and test counts that would become inaccurate on the next change.

### Wiki coverage and navigation

- Fixed US party aliases to numeric party routes.
- Added visible learning paths for new players, economic operators, advanced politics, military play, and Cold War operations.
- Added wiki pages for referendums, political operations and Campaign Presence, household demand, and imperial characters.
- Expanded country aliases, country-hub links, command-economy and Irish presidency routes, and military path coverage.
- Corrected the standalone-site builder so links to game-only routes resolve against the game site instead of becoming broken same-origin docs links.

## Maintenance rules

1. Put exact mechanics beside their implementation symbol or generated source where possible.
2. Label plans, migration sequences, and one-time audits with their date and status.
3. Avoid static repository-wide counts unless a check regenerates them.
4. Keep seeded wiki links canonical and cover compatibility aliases in `navigationIntegrity.test.ts`.
5. When a system has both corporate and sovereign variants, name the borrower and trigger explicitly.
6. Run the design build, design consistency check, wiki navigation tests, TypeScript, formatting, lint, application build, and standalone-site link scan before publishing documentation changes.
