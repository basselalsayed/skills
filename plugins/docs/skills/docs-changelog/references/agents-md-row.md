# AGENTS.md section and row for `docs-changelog`

All `docs-*` skills share one section in the guidance file. Each skill owns a
marker line and the row(s) under it.

## Section skeleton (create only if `<!-- docs-skills:start -->` is absent)

Place it at the end of the file, separated by one blank line:

```markdown
<!-- docs-skills:start -->
## Docs
Conventions for `docs/` come from the `docs-*` skills (vendored under `.agents/skills/`). Read `docs/README.md` for the map.
| Need | Read | Rule |
| --- | --- | --- |
<!-- docs-skills:end -->
```

## This skill's block

```markdown
<!-- docs-changelog -->
| What changed | `docs/changelog/DD-MM-YYYY.md` | EVERY in-scope commit appends an entry, staged in the same commit. Follow `docs-changelog` |
```

## Placement

Blocks keep a fixed order inside the section: `docs-features`,
`docs-changelog`, `docs-todo`. Insert this block immediately before the
`<!-- docs-todo -->` marker if it exists, otherwise immediately before
`<!-- docs-skills:end -->`. If `<!-- docs-changelog -->` already exists, change
nothing.
