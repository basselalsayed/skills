# Safety and verification

## Protect the starting state

Immediately before integration:

1. Record the original `HEAD` SHA.
2. Create a unique `backup/rebase-<sanitized-current-branch>-<UTC timestamp>` branch there.
3. Verify that the backup ref resolves to the original SHA.
4. If tracked or untracked changes exist, create a named stash including untracked files, record its object SHA, and verify the worktree is clean.
5. Warn about relevant ignored files; include them only with explicit approval.

Use the explicit safety stash instead of `git rebase --autostash` so its recovery identity remains clear. Never discard local state.

## Restore local changes

After successful integration, reapply the recorded stash without dropping it. Handle application conflicts under the normal conflict policy. Drop it only when explicitly requested and its contents are confirmed present.

## Verify

1. Confirm no rebase or merge remains in progress.
2. Confirm target ancestry:

   ```sh
   git merge-base --is-ancestor "<target>" HEAD
   ```

3. Confirm the backup still resolves to the original SHA.
4. Inspect `git status`, the final graph, new commits, unexpected changes, submodules, and restored local changes.
5. For rebase, use `git range-diff` between the old series and new series; investigate dropped, duplicated, or materially changed patches.
6. For merge, inspect the merge commit and combined diff when a merge commit exists.
7. Check changed text files for conflict markers.
8. Run focused checks, then broader tests, lint, typecheck, and build in proportion to the change. Never claim success for skipped or unavailable checks.

If validation fails, compare against the backup and merge base to distinguish integration defects from pre-existing failures.

## Recovery

On unsafe failure, abort the active operation and verify restoration to the original SHA. Keep the backup and safety stash. Report exact recovery refs and commands; never delete them automatically.
