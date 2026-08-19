# Shadow ledger: double-entry conservation checking

The **shadow ledger** is a double-entry journal layered over the game's single-entry
`financialTxLog`. It exists to structurally catch the *silent money-corruption* bug
class, FX-mismatch writes (the t841 nationalization blowup, 2,300× inflation), ghost
counterparties (the 15.3T ITL carry trade), unfunded interest, dropped/double debits,
and "doesn't debit / reverts next turn" tickets, by asserting a conservation law over
every ₳ movement and alarming the **same turn** a violation happens instead of turns later.

It is **shadow-only** (Phases 1-3): the game never reads it and behaviour never changes.
It observes and alarms. Enforcement (rejecting unbalanced writes) is a later, separately
gated phase. Full design: game repo the design archive and the
`src/lib/ledger/` module (`accounts.ts`, `deriveFromTx.ts`, `emit.ts`, `reconcile.ts`,
`report.ts`, `types.ts`).

## The `ledgerShadow` flag

A `gameConfig` feature flag (flags-as-seed-defaults, PR #2627 style): **on by default in
prod seeds** (`src/lib/seeds/reference/gameConfig.ts`). When on, `emitTx`/`emitTxBulk`
(`src/lib/financialTxLog/emit.ts`) also derive a balanced ledger entry from each tx-log
row, and the reconciler runs each turn. When off, none of the collections below are
written, a `trace_ledger` call on such a world correctly reports "no data".

## The two collections

### `ledgerEntries`, the journal
One balanced entry per money event, derived per transaction. Each has ≥2 `legs`; the sum
of the legs' `anchorAmount` (the ₳-snapshot value at emit time) **must be 0** within ε.
Same-currency legs must also net to 0 in native units, that second check is what catches
the t841 class (raw NGN stored as GBP balances in neither). Legs carry a `role`
(`primary` = the authoritative balance that moved; `contra` = the counter-leg, either a
real counterparty or a system `mint:`/`sink:` bucket). Single-sided rows get a
`mint:unattributed` / `sink:unattributed` leg, deliberately ugly, it *is* the Phase 3
coverage work queue. `emitSite` records the grep-able origin.

### `ledgerReconciliations`, the per-turn verdict
One doc per reconciler run, with an overall `status` (`green` / `amber` / `red`) and three
sub-checks, each with their own status and findings:

- **`trialBalance`**, every entry balances (Invariant #1). Unbalanced → red, with the
  offending `entryId`, `emitSite`, and `anchorResidual`.
- **`stockVsFlow`**, for each account active this turn, the authoritative Mongo balance
  delta (from `balanceSnapshots`) vs the sum of its ledger legs. Divergence names the
  `account`, the `actualDelta`, the `ledgerDelta`, and whether it moved with **no ledger
  legs at all** (`uninstrumented`, an uncovered write site). Skipped on reset epochs
  (era resets / admin reseeds re-baseline snapshots instead of alarming).
- **`moneySupply`**, per currency: minted, sunk, `netDrift`, and a `byReason` breakdown.
  The AHD economy is not closed (sector revenue, interest are created ex nihilo), so this
  turns "is money conserved?" into a checkable per-reason residual. An unexplained
  residual is exactly the ghost-bank signature.

`unattributed` on the doc ranks the single-sided mint/sink legs by |anchor|, the Phase 3
backlog. A third collection, `balanceSnapshots`, holds per-turn authoritative balances and
is the *stock* side of the stock-vs-flow check.

## How to read a reconciliation

- **Ops dashboard / Watchtower:** the reconciler feeds a green/amber/red section of the
  daily report. Admin endpoint in the game repo: `GET /api/admin/ledger/reconciliation`
  (returns the latest section + a trend of recent runs).
- **Green** = all three checks pass. **Amber** = divergences within tolerance / expected
  `unattributed` noise. **Red** = an unbalanced entry, a real stock-vs-flow divergence, or
  a money-supply residual, investigate with `trace_ledger`.

## Forensic tool: `trace_ledger`

Lives on the **gamestate MCP** (`ahd-ops-dashboard/mcp/gamestate-server.js`, port 9730),
alongside `trace_character` / `trace_corp` / `trace_election` / `trace_sector`. Read-only.

Given a `turn` (default: latest reconciliation on record; otherwise the newest at or before
the requested turn) it returns the reconciler verdict, the unbalanced entries and divergent
accounts with their emit sites, the money-supply residuals, and the ranked `unattributed`
legs. Add an `account` (canonical id, e.g. `character:<id>:USD`, `government:US:USD`,
`fx:NGN/GBP`) or an `entity` fragment (a raw character/corp/party/country id, matches any
account containing it) to also pull every journal entry (both legs) touching it that turn,
plus that account's balance-snapshot delta. That is the direct path from "there's ghost
money" to the exact unbalanced entry, emit site, and source doc that produced it.

## Related incidents / systems

- **t841 nationalization FX blowup**, cross-currency nationalization stored raw local
  revenue without FX conversion; the native-vs-anchor balance check is built to catch it.
- **Standalone-Mongo no-txns desyncs** (#877/879/880), non-atomic writes producing
  dropped/double debits; stock-vs-flow flags the resulting divergence.
- **Ghost-bank carry trade** (CB/forex audit t817), a phantom counterparty shows up as an
  unexplained money-supply residual.
- **Watchtower / Observatory**, the reconciler publishes into the existing daily-report
  cron; no new service.
- **Support pipeline**, "money didn't debit / reverted next turn" tickets become traceable
  via `trace_ledger` instead of manual log grepping.
