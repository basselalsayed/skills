---
name: docs-todo
description: "Deferred work as committed files under docs/todos/: one Markdown file per deferred feature, fix or open question, linked from the doc that defers it, and deleted by the commit that ships it. Use when deferring anything, recording an open question, picking up or finishing deferred work, or cleaning stale todos. Triggers on: todo, defer, deferred, follow-up, later, open question, backlog, docs/todos."
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
  - Glob
  - Grep
---

# Docs: todos

Deferred work lives in the repo, not in chat or in a plan file: one file per
item under `docs/todos/`, deleted when the work ships.

## First use (run before the task)

1. Collect guidance-file candidates at the repo root: `AGENTS.md`, `CLAUDE.md`,
   `.claude/CLAUDE.md`. Resolve symlinks; files that resolve to the same file or
   have identical content count as one target. Always edit the resolved
   target; never replace a symlink with a file.
2. If the marker `<!-- docs-todo -->` is present in **any** candidate,
   continue with the task. Ask nothing.
3. Otherwise ask once per skill per session: "Add the `docs-todo` pointer to
   your agent guidance file?" Offer one option per distinct target, listing
   its aliases in the option description (e.g. "`AGENTS.md` (also
   `.claude/CLAUDE.md`)"), plus *Not now*. Use `AskUserQuestion` when the host
   provides it; otherwise ask in one plain sentence and wait.
4. On insert: follow [references/agents-md-row.md](references/agents-md-row.md).
   In the resolved target file, create the
   `<!-- docs-skills:start -->`…`<!-- docs-skills:end -->` section if absent,
   then add this skill's marker and row inside it. Never insert twice. If
   the chosen file is a copy of another candidate (identical content), say so
   and insert into both so they stay identical.
5. On *Not now*: leave every guidance file untouched, say so once and
   continue; ask again only in a new session. Users who never want it add the
   marker by hand.
6. Always, whatever happened in steps 2–5 (pointer consent and template
   copying are independent): if `docs/todos/README.md` is absent, copy
   [assets/docs/todos/README.md](assets/docs/todos/README.md) there (create
   only; never overwrite).

## File format

`docs/todos/<slug>.md`, slug in kebab-case naming the work:

```markdown
# <title>
- Created: DD-MM-YYYY · Origin: F-104 / ADR-0007 / commit abc123
- Why deferred: ...
## What to do
```

`Origin` names whatever deferred it: a feature ID, an ADR, a design doc, a
plan section or a commit. `What to do` is concrete enough for someone else to
pick up.

## Rules

1. **One file per item.** Do not batch unrelated work into one todo.
2. **Linked from somewhere.** The doc that defers the work links the todo: a
   feature doc's `Deferred:` header line or `## Open questions`, an ADR, or a
   design doc. An unlinked todo fails `check-docs` (from `docs-features`).
3. **Deleted on ship.** The commit that ships the work deletes the file,
   removes live links to it from feature docs and other docs, and names the
   slug in its changelog entry as plain text. `check-docs` fails on a
   dangling link.
