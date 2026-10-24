---
name: docs-features
description: "Feature registry and decision docs under docs/: a master list of built and planned features (docs/features/README.md) with one doc per feature split into Current behaviour and Proposed changes, MADR 4.0 ADRs in docs/adr/, design docs in docs/design/, and project principles. Converts every approved plan into these docs before implementation. Use when the user approves a plan, when planning or shipping a feature, when changing a decision, when asked what exists or is planned, or to set up docs/ in a new repo. Triggers on: approved plan, feature registry, feature doc, requirement, scenario, ADR, MADR, design doc, principles, built, shipped, evidence, check-docs, init docs."
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
  - Glob
  - Grep
---

# Docs: features, decisions, designs

`docs/` is the record of what a project is and why. Plans are inputs; once
approved they are converted into these docs and stop being the record.

| Path | Holds |
| --- | --- |
| `docs/README.md` | Map: what lives where, who reads what |
| `docs/principles.md` | Invariants and non-goals; read before planning any feature |
| `docs/features/README.md` | The registry: one row per feature, per phase |
| `docs/features/<slug>.md` | One feature: Current behaviour / Proposed changes |
| `docs/adr/` | MADR 4.0 decision records and their index |
| `docs/design/` | One technical design per file, linked from feature docs |
| `docs/migration/` | Ledgers for absorbed plans |

## First use (run before the task)

1. Collect guidance-file candidates at the repo root: `AGENTS.md`, `CLAUDE.md`
   (and `.claude/CLAUDE.md`), plus any other agent file the user names (for
   example `GEMINI.md`, `.cursor/rules/`, `.github/copilot-instructions.md`).
   Resolve symlinks; files that resolve to the same file count as one target.
   Always edit the resolved target; never replace a symlink with a file.
2. If the marker `<!-- docs-features -->` is present in **any** standard candidate
   (`AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`), continue with the task.
   Ask nothing.
3. Otherwise ask once per skill per session, as a **multi-select** question:
   "Which agent guidance files should get the `docs-features` pointer?" Options:
   `AGENTS.md`, `CLAUDE.md`, `Others`, `Not now`. Say in each option's
   description whether the file exists, will be created, or is an alias of
   another candidate (e.g. "also `.claude/CLAUDE.md`"). `Others` means the
   user names the paths in free text. Use `AskUserQuestion` with
   `multiSelect: true` when the host provides it; otherwise ask in one plain
   sentence listing the same choices and wait. Selecting *Not now* together
   with files means *Not now*.
4. On insert, for every selected target: follow
   [references/agents-md-section.md](references/agents-md-section.md). In the
   resolved target file (created if it does not exist), create the
   `<!-- docs-skills:start -->`…`<!-- docs-skills:end -->` section if absent,
   then add this skill's marker and rows inside it. Never insert twice into
   one file. If a selected file is an identical copy of an unselected
   candidate, say so and insert into both so they stay identical.
5. On *Not now*: leave every guidance file untouched, say so once and
   continue; ask again only in a new session. Users who never want it add the
   marker by hand.
6. Always, whatever happened in steps 2–5 (pointer consent and template
   copying are independent): **init** when `docs/features/README.md` is
   absent. Copy [assets/docs/](assets/docs/) into `docs/`, **creating only
   missing files**. List every file skipped because it already exists, then
   run `scripts/check-docs.mjs` from the project root.

## Registry upkeep and lifecycle

Details and templates: [references/feature-format.md](references/feature-format.md).

- Every feature has a registry row and a feature doc with matching ID and
  status. Statuses: `planned`, `in-progress`, `built`, `deferred`, `dropped`.
- `built` requires an `Evidence:` line (test name, CI job or commit). Verify
  against the repo; never mark from the plan alone.
- A feature doc has `## Current behaviour` (built and verified) and
  `## Proposed changes` (approved, not yet shipped). Requirements are
  `#### Requirement:` with a `SHALL` sentence and at least one
  `##### Scenario:` (`WHEN … THEN …`).
- An approved plan that modifies a built feature adds a
  `### Change: <slug> (approved DD-MM-YYYY)` block under Proposed. The
  executor merges it into Current only when the verifier confirms the ship,
  then deletes the block and names the feature ID in the changelog entry.
- Significant decisions get a MADR ADR; a change to an existing decision
  **amends or supersedes** that ADR
  ([references/adr-madr.md](references/adr-madr.md)).

## Plan conversion

Triggered when the user approves a plan from any skill. Conversion is its own
commit, before the first implementation commit.

1. Registry row per feature introduced or changed, `Depends on` filled.
2. A `### Change:` block under Proposed changes in each affected feature doc.
3. A MADR ADR only for significant new decisions; amend/supersede existing
   ADRs otherwise.
4. A design doc per technical design section.
5. A todo per deferred item or open question (follow `docs-todo`).
6. The conversion commit's changelog entry lists the IDs created (follow
   `docs-changelog`).

Proportionality: a plan touching one feature produces one change block and no
new ADR unless a decision changed. Full procedure:
[references/plan-conversion.md](references/plan-conversion.md).

## Conflicts between sources

When the plan, docs, ADRs and code disagree, apply the precedence policy and
record the outcome in the ledger:
[references/precedence-and-ledger.md](references/precedence-and-ledger.md).

## Check

`scripts/check-docs.mjs [<root>]` takes the project root (the directory that
contains `docs/`; default: the current directory) and reads `<root>/docs` plus
`AGENTS.md`, `CLAUDE.md` and `.claude/CLAUDE.md`. It verifies: links resolve
(incl. ledger destinations and anchors); registry rows ⇄ feature files with
matching ID and status; unique IDs; `built` rows have Evidence; ADR files ⇄
index with MADR frontmatter and headings (Confirmation when accepted); todos
linked from somewhere; statuses from the vocabulary; every Requirement has a
Scenario. It exits 0 when clean, 1 with `file:line` on problems, 2 on bad
usage; `--self-test` runs its fixtures. Run it before every docs commit.

Projects vendor the skill so CI can call it
(`npx skills add basselalsayed/skills --skill docs-features -a claude-code`,
then `"check:docs": "node .agents/skills/docs-features/scripts/check-docs.mjs"`).

## Reference index

| Concern | Reference |
| --- | --- |
| Registry rows, feature doc format, lifecycle | [references/feature-format.md](references/feature-format.md) |
| ADR format and rules | [references/adr-madr.md](references/adr-madr.md) |
| Converting an approved plan | [references/plan-conversion.md](references/plan-conversion.md) |
| Precedence policy and migration ledger | [references/precedence-and-ledger.md](references/precedence-and-ledger.md) |
| The AGENTS.md section | [references/agents-md-section.md](references/agents-md-section.md) |
