---
name: docs-changelog
description: "Per-commit engineering journal under docs/changelog/: one file per day (DD-MM-YYYY.md), and every in-scope commit appends a `## <subject>` entry to that file, staged in the same commit. Use whenever you are about to commit in a repo with docs/changelog/, when amending or rebasing commits, when setting up or fixing the changelog CI check, or when the user asks what changed on a day. Triggers on: commit, changelog, journal, check-changelog, activation boundary, rebase, amend, revert."
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
  - Glob
  - Grep
---

# Docs: changelog

`docs/changelog/` is an engineering journal by explicit preference: one entry
per development commit, written by whoever makes the commit. It is **not** a
curated release changelog in the Keep-a-Changelog sense.

## First use (run before the task)

1. Collect guidance-file candidates at the repo root: `AGENTS.md`, `CLAUDE.md`,
   `.claude/CLAUDE.md`. Resolve symlinks; files that resolve to the same file or
   have identical content count as one target. Always edit the resolved
   target; never replace a symlink with a file.
2. If the marker `<!-- docs-changelog -->` is present in **any** candidate,
   continue with the task. Ask nothing.
3. Otherwise ask once per skill per session: "Add the `docs-changelog` pointer to
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
   copying are independent): if `docs/changelog/README.md` is absent, copy
   [assets/docs/changelog/README.md](assets/docs/changelog/README.md) there
   (create only; never overwrite) and tell the user to fill in the activation
   SHA after the first commit that follows this convention.

## Entry format

File `docs/changelog/DD-MM-YYYY.md`, named by the commit's **author date**
(`git log -1 --format=%ad --date=format:%d-%m-%Y`):

```markdown
# 23-10-2026
## <commit subject, verbatim>
One to three lines. Name feature IDs, ADR numbers, todo slugs (plain text, not links) touched.
```

Create the file with its `# DD-MM-YYYY` heading if it does not exist; append
otherwise. Entries are append-only, so two branches touching one day-file
conflict only trivially.

## Per-commit procedure

1. Settle the commit subject first.
2. Append `## <subject>` plus at least one body line to today's day-file.
   Mention feature IDs (`F-104`), ADR numbers (`ADR-0007`) and todo slugs that
   the commit creates, changes or closes.
3. `git add docs/changelog/<day>.md` together with the change, in the **same**
   commit.
4. `fixup!` / `squash!` prefixes are stripped before comparison, so a fixup
   commit's entry uses the target subject. A revert commit's entry says what it
   reverts.
5. After a rebase or amend that changes a subject or the author date, update
   the entry in that same commit; the checker verifies the final commits as
   they are.

## Policy (recorded in `docs/changelog/README.md`)

- **Activation boundary:** the first commit that follows the convention; its
  SHA is recorded in the README. Commits before it are never checked.
- **Scope:** development commits as they appear in a PR. Merge commits,
  squash-merge commits created by GitHub on `main`, and commits authored by
  `renovate[bot]` are exempt.
- **Entry rule:** each in-scope commit adds, as `+` lines in its own diff, a
  `## <subject>` heading equal to its subject in the day-file named by its
  author date, plus at least one body line.

## Checker

`scripts/check-changelog.mjs <base>..<head>` verifies every in-scope commit in
the range; `scripts/check-changelog.mjs --self-test` builds fixture repos
(ordinary, merge, squash, fixup, reword, revert, bot, pre-boundary) in a temp
dir and asserts pass/fail. Run it before pushing.

Projects call the vendored copy (`npx skills add basselalsayed/skills --skill
docs-changelog -a claude-code`), e.g. a `package.json` script
`"check:changelog": "node .agents/skills/docs-changelog/scripts/check-changelog.mjs"`.
A plugin-cache install is for personal use; CI needs the vendored path. CI
passes these ranges and checks out with `fetch-depth: 0`:

| Event | Range |
| --- | --- |
| `pull_request` | `${{ github.event.pull_request.base.sha }}..${{ github.event.pull_request.head.sha }}` |
| `push` | `${{ github.event.before }}..${{ github.sha }}` (skip when `before` is all zeros) |
