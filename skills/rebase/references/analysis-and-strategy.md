# Analysis and strategy

## Inspect both sides

Find the merge base and inspect:

```sh
git merge-base HEAD "<target>"
git rev-list --left-right --count HEAD..."<target>"
git log --oneline --decorate --graph --boundary HEAD..."<target>"
git diff --stat "$(git merge-base HEAD "<target>")"..HEAD
git diff --stat "$(git merge-base HEAD "<target>")".."<target>"
git diff --name-status "$(git merge-base HEAD "<target>")"..HEAD
git diff --name-status "$(git merge-base HEAD "<target>")".."<target>"
```

Use correctly quoted equivalents when needed. Read substantive diffs and representative commits; do not decide from line counts alone.

Inspect:

- Commit counts, merge and fixup commits, and commit dependencies.
- Configured upstreams and local remote-tracking refs for evidence that current commits are published. Absence locally does not prove privacy.
- Changed files and logical areas on each side.
- Same-file and same-hunk overlap, renames, deletions, binaries, submodules, generated files, lockfiles, migrations, schemas, public APIs, and dependency changes.
- Repository contribution guidance and integration policy.
- Likely conflicts, using `git merge-tree` when supported.
- Available focused and broad validation commands.

## Choose the strategy

Prefer **rebase** when most apply:

- Current commits are private or rewriting is accepted.
- The current side is small or moderate and logically coherent.
- Linear history improves review.
- Conflict overlap is limited and unlikely to recur across commits.
- There is no meaningful merge topology, or `--rebase-merges` can safely preserve it.

Prefer **merge** when any strong signal makes replay disproportionately risky:

- Commits are shared, reviewed by stable SHA, deployed, or used by others.
- The change is large or cross-cutting and would repeat conflicts across commits.
- Both sides have substantial interdependent changes better resolved once.
- Meaningful merge topology must remain intact.
- Release, audit, or repository policy favors traceable merge commits.
- Rebase would obscure provenance or make validation materially harder.

Size is evidence, not an automatic rule. Compare the risk and cost of replaying every commit with resolving one combined merge.

Proceed with the clearly safer strategy. Ask only when the strategies are balanced, policy is unclear, or publication risk cannot be established.
