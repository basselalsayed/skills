# Features
Humans track status here; agents read the row, then the linked feature doc.
Status: planned | in-progress | built (needs Evidence) | deferred (links a todo) | dropped

## Phase 0: Foundations

| ID | Feature | Status | Requirement (one line) | Depends on | Docs | Plan tasks |
| --- | --- | --- | --- | --- | --- | --- |
| F-001 | Repo and CI | built | CI runs fmt, clippy and the docs check | — | [spec](repo-ci.md) · [ADR-0001](../adr/0001-use-ci-gate.md) | T0.1 |
|F-002|Widget|planned|The app SHALL show a widget|F-001|[spec](widget.md)|T0.2, T0.3|

## Phase 2: Organising

| ID | Feature | Status | Requirement (one line) | Depends on | Docs | Plan tasks |
| --- | --- | --- | --- | --- | --- | --- |
| F-201 | Organising | planned | Members can organise | F-002 | [spec](organising.md) | — |

## Non-goals (never build)

- No social feed.
