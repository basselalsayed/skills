# Docs

The record of what this project is, what it does, and why. Approved plans are
converted into these files before implementation; plan files are not the
record.

| Path | Holds | Read it when |
| --- | --- | --- |
| [principles.md](principles.md) | Invariants and non-goals | Before planning any feature |
| [features/README.md](features/README.md) | Registry of built and planned features | You need to know what exists or is planned |
| `features/<slug>.md` | One feature: current behaviour and proposed changes | Working on that feature |
| [adr/README.md](adr/README.md) | Decision records (MADR 4.0) | You need to know why something was decided |
| [design/README.md](design/README.md) | Technical designs | Implementing or reviewing a design |
| `migration/` | Ledgers for absorbed plans | Auditing where a plan's content went |
| `changelog/` | One file per day, one entry per commit | You need to know what changed |
| `todos/` | One file per deferred item | Picking up deferred work |

Agents: read the registry row, then the linked feature doc, then only the ADR
and design sections it links.
