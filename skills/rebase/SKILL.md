---
name: rebase
description: Safely integrate another Git branch into the current branch after analyzing both histories and deciding whether rebase or merge is more appropriate. Use for `/rebase branch-name`, `$rebase branch-name`, “rebase onto…”, “update my branch from…”, or similar Git-history integration requests, including natural-language branch arguments such as `/rebase origin feature-2`. Ask for the branch when it is omitted; inspect the diff and conflict risk, protect the starting state, execute the selected integration strategy, resolve only unambiguous conflicts, and verify the result.
---

# Rebase

Integrate a target branch into the current branch with an engineer-grade, recoverable workflow. Treat “rebase” as the outcome category, not a mandate to rewrite history when a merge is safer.

## Rules

- Require a target branch; if omitted, ask for it and do nothing else.
- Never guess between multiple valid refs.
- Analyze before mutation and create a backup immediately before integration.
- Never discard local changes, commits, or untracked files.
- Never resolve a semantic conflict without user input.
- Never push, delete the backup, or drop a safety stash unless explicitly requested.
- Never use plain `--force`; use `--force-with-lease` only after explicit push approval.
- Preserve unrelated user changes.

## Workflow

### 1. Resolve and inspect

Interpret all text after the invocation as a natural-language ref:

1. Remove filler such as `branch`, `onto`, or `from` without changing meaningful punctuation.
2. Try the text exactly; for two tokens such as `origin feature-2`, also try `origin/feature-2`.
3. Resolve with `git rev-parse --verify --quiet "<candidate>^{commit}"`.
4. If multiple refs resolve to different commits, show them and ask.

Record the resolved ref and SHA. Report no-op if it equals `HEAD`.

Inspect the repository, current branch, `HEAD`, status, worktrees, submodules, and any in-progress Git operation. Stop for an existing operation, detached `HEAD`, or unexpected current branch. Record staged, unstaged, untracked, and relevant ignored files separately.

If using a remote-tracking ref, fetch its remote when possible and re-resolve its SHA. Use a potentially stale ref only with user acceptance.

### 2. Analyze and decide

Read [analysis-and-strategy.md](references/analysis-and-strategy.md) completely now. Follow it to inspect both histories and substantive diffs, predict conflicts, determine publication risk, and choose rebase or merge.

Before mutation, report the branches and SHAs, ahead/behind counts, diff and overlap summary, publication status, predicted conflicts, validation plan, chosen strategy, and decisive reasons. Ask only when the strategies are balanced, policy is unclear, or rewriting may affect collaborators.

### 3. Protect the starting state

Read [safety-and-verification.md](references/safety-and-verification.md) completely now.

Record the original `HEAD`; create and verify a unique `backup/rebase-<branch>-<UTC timestamp>` ref there. Explicitly stash tracked and untracked changes when present, record the stash SHA, and verify a clean worktree. Warn before including ignored files. Do not use `git rebase --autostash`.

### 4. Execute

- Rebase a linear history with `git rebase "<target>"`.
- Use `--rebase-merges` only to intentionally preserve meaningful merge topology.
- Do not silently use `--onto`, interactive editing, dropping, or squashing.
- For merge, follow repository policy; allow faithful fast-forwards and create a merge commit only when topology or policy requires it.

Monitor every command. On failure, inspect status and operation state before acting.

### 5. Handle conflicts

If any conflict occurs, read [conflicts.md](references/conflicts.md) completely and follow it. Resolve only evidence-backed mechanical conflicts; pause for user input on semantic choices. Use its lockfile regeneration fast path instead of reading or manually merging lockfile hunks.

If safe completion becomes unlikely, abort, verify restoration to the original `HEAD`, and retain the backup and stash.

### 6. Restore and verify

Follow the restoration and verification procedure in [safety-and-verification.md](references/safety-and-verification.md). Reapply but do not drop the safety stash. Verify ancestry, backup integrity, history or patch equivalence, worktree state, conflict-marker absence, and relevant project checks.

Distinguish integration defects from pre-existing failures. Fix only clear integration defects; otherwise preserve the recoverable state and report evidence.

### 7. Report

Report the strategy and rationale, old and new `HEAD`, target ref and SHA, backup ref, stash SHA, conflicts and decisions, verification outcomes, remaining risks, and whether a push is needed.

Do not push automatically. If rebase rewrote a published branch, explain why a normal push will fail and request approval before `git push --force-with-lease <remote> <branch>`.

After successful verification, explicitly ask whether the user wants the named backup branch removed. Keep it unless they confirm; before deletion, verify the exact ref still points to the recorded original `HEAD`.
