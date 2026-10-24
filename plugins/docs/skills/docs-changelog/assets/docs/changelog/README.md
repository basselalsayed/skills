# Changelog

An engineering journal: one file per day (`DD-MM-YYYY.md`), one entry per
development commit, added in the same commit. This is not a curated release
changelog in the Keep-a-Changelog sense.

Activation boundary: `<sha>`

## Format

```markdown
# DD-MM-YYYY
## <commit subject, verbatim>
One to three lines. Name feature IDs, ADR numbers, todo slugs (plain text, not links) touched.
```

## Rules

- **Activation boundary:** the commit above is the first one checked. Commits
  before it are never checked.
- **Scope:** development commits as they appear in a PR. Merge commits,
  squash-merge commits created by GitHub on `main`, and commits authored by
  `renovate[bot]` are exempt.
- **Entry rule:** each in-scope commit adds (as `+` lines in its own diff) a
  `## <subject>` heading equal to its subject in the day-file named by its
  author date (`%ad`, `format:%d-%m-%Y`), plus at least one body line.
  `fixup!` / `squash!` prefixes are stripped before comparison; a revert
  commit's entry says what it reverts.
- **History rewrites:** after a rebase that changes a subject or date, update
  the entry in that commit. The checker verifies the final PR commits, so an
  amended commit is checked as amended.
- **Checker:** `check-changelog.mjs <base>..<head>` (from the `docs-changelog`
  skill) runs in CI on every pull request and push.
