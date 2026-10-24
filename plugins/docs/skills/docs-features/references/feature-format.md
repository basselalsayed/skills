# Feature registry and feature docs

## Registry: `docs/features/README.md`

One table per phase plus the non-goals. Humans track status here; agents read
the row, then the linked feature doc, then only the ADR/design sections it
links.

```markdown
# Features
Humans track status here; agents read the row, then the linked feature doc, then only the ADR/design sections it links.
Status: planned | in-progress | built (needs Evidence) | deferred (links a todo) | dropped

## Phase 0: Foundations
| ID | Feature | Status | Requirement (one line) | Depends on | Docs | Plan tasks |
| --- | --- | --- | --- | --- | --- | --- |
| F-001 | Repo, CI and lint gate | in-progress | CI runs fmt, lint and the layer checks; seeded violations fail | — | [spec](repo-ci-gate.md) · ADR-0005 | T0.1 |

## Non-goals (never build)
- ...
```

Row rules:

- `ID` is `F-NNN`, unique, stable, never reused. Encoding the phase in the
  hundreds digit (`F-0NN`, `F-1NN`, `F-15N` for a Phase 1.5) keeps rows easy
  to place.
- `Status` is one of `planned`, `in-progress`, `built`, `deferred`, `dropped`.
  `deferred` links a `docs/todos/` file. `built` requires an `Evidence:` line
  in the feature doc.
- `Depends on` lists feature IDs, or `—`.
- `Docs` has at least one link; the first is the feature doc.
- `Plan tasks` keeps the source plan's task IDs as aliases (traceability); a
  task ID appears in exactly one row.
- Verify status against the repo before writing it: code wins over the plan.

## Feature doc: `docs/features/<slug>.md`

```markdown
# F-104: Worker badge
- Status: planned · Phase: 1 · Plan tasks: T1.8, T1.9 · Depends on: F-101, F-112
- Evidence: (required when built: test name / CI job / commit)
- Decisions: ADR-0001 · Design: [worker-badge](../design/worker-badge.md) · Deferred: [slug](../todos/slug.md)

## Current behaviour
(empty until built; then the verified contract, as Requirement/Scenario blocks)

## Proposed changes
### Change: initial (approved 23-10-2026, <source plan>)
#### Requirement: Redacted proof only
The app SHALL upload only the on-device redacted crop and coarse fields.
##### Scenario: screenshot contains a name
WHEN the OCR pass finds a name field THEN the redaction preview masks it before upload is enabled.

## Non-goals
## Open questions
(each links a docs/todos/ file)
```

Rules:

- The header `Status` matches the registry row.
- Every `#### Requirement:` has a `SHALL` sentence and at least one
  `##### Scenario:` written as `WHEN … THEN …`. Far-future phases may carry
  Requirements without Scenarios and a "re-plan before starting" note.
- Links are repo-relative Markdown links that resolve.
- Each open question links a todo; each deferred item is a todo.

## Lifecycle

1. **Approved, not shipped** → a `### Change: <slug> (approved DD-MM-YYYY)`
   block under `## Proposed changes`. The first one for a new feature is
   `### Change: initial (approved DD-MM-YYYY, <source>)`.
2. **Changing a built feature** → a new change block under Proposed; Current
   behaviour stays as it is until the change ships.
3. **Verified ship** → only when the verifier confirms it, the executor moves
   the change's requirements into `## Current behaviour` (replacing what they
   supersede), deletes the change block, fills `Evidence:` (test name, CI job
   or commit), updates the registry status, and names the feature ID in the
   changelog entry.
4. **Deferred / dropped** → status in the row and the doc header; deferred
   links its todo.
