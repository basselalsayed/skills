# Ralplan v20 migration ledger

| Column | Meaning |
| --- | --- |
| Source (§/line) | Section and line range. |

| Source (§/line) | Unit | Destination (path#anchor) or Disposition | Conflict resolved by |
| --- | --- | --- | --- |
| §4.4/876 | Outbox claim uses SKIP LOCKED | docs/design/backend.md#outbox-claim--ack-v2 | — |
| §8.3/2014 | T0.1 repo and CI | `docs/features/repo-ci.md#requirement-format-gate` | rule a: CI job vs §8.3 text |
| §8.3/2020 | T0.2 widget | [widget](../features/widget.md#change-initial-approved-23-10-2026-ralplan-v20) | — |
| §10/2772 | ADR-0002 queue | dropped: superseded by docs/adr/0001-use-ci-gate.md | rule b: ADR-0001 vs §10 ADR-0002 |
| §13/3087 | v12 review notes | dropped: review history | — |
| §11/2930 | Flaky runners question | todo: flaky-ci | — |
| §10/2800 | Queue choice | docs/adr/0002-pick-a-queue.md | rule d: §10 block vs v15 note |
