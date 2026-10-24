# Precedence and the migration ledger

## Precedence policy

Applies whenever two sources disagree: while converting or absorbing a plan,
and afterwards.

| Rule | Source (highest first) |
| --- | --- |
| a | Implemented code and passing tests |
| b | Committed ADRs (accepted, plus any proposed gate ADR already in the repo) |
| c | The latest body of the source plan |
| d | Decision blocks inside the plan and earlier version notes |

- A lower source never overrides a higher one.
- Every conflict resolved this way gets a ledger row naming both sources and
  the outcome (e.g. `rule b: ADR-0008 over plan §4.5`).
- The doc records the current rule only. Version annotations (`v15`, `Q21`)
  stay in the ledger, not in the docs.
- Before claiming anything is built, verify it in the repo; `built` needs an
  Evidence line. Stale paths in the plan lose to the actual layout.

## Absorbing a large plan

1. Keep the source immutable and out of the tree agents read (for example an
   orphan archive branch) until the ledger closes. No doc under `docs/` links
   to the plan's local path or to the archive.
2. Fill `docs/migration/<plan>-ledger.md` while writing the docs.
3. The ledger closes when no row is empty, every destination resolves, and
   every conflict row cites a precedence rule. Until then a todo
   (`docs/todos/absorb-<plan>-ledger.md`) stays open.

## Ledger format

One row per normative unit of the source: every feature bullet, every
invariant, number and threshold, every task ID, every dependency and owner,
every acceptance gate, every decision block, every open question.

```markdown
| Source (§/line) | Unit | Destination (path#anchor) or Disposition | Conflict resolved by |
| --- | --- | --- | --- |
| §4.5 l.987 | Factor-counted cancel | docs/design/recovery.md#cancel-rules | rule c: §4.5 over §10 ADR-0001 |
| §10 l.2840 | Old cancel wording | dropped: superseded by docs/adr/0001-recovery.md | rule c: §4.5 over §10 ADR-0001 |
| §11 Q4 | Retention period | todo: retention-period | — |
```

- **Destination**: a repo-relative path from the `docs/` root
  (`docs/design/x.md#github-slug-of-heading`); the anchor must exist as a
  heading in that file.
- **Disposition** instead of a destination: `dropped: superseded by <where>`,
  `dropped: review history`, or `todo: <slug>` (and `docs/todos/<slug>.md`
  exists and is linked).
- **Conflict resolved by**: `—`, or `rule a|b|c|d` plus both sources.
- No cell is empty. `scripts/check-docs.mjs` verifies every destination path
  and anchor.
