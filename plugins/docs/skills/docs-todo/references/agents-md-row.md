# AGENTS.md section and row for `docs-todo`

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
<!-- docs-todo -->
| Deferred work | `docs/todos/` | Deferred features/fixes become a committed file; delete when shipped. Follow `docs-todo` |
```

## Placement

Blocks keep a fixed order inside the section: `docs-features`,
`docs-changelog`, `docs-todo`. This block is last: insert it immediately
before `<!-- docs-skills:end -->`. If `<!-- docs-todo -->` already exists,
change nothing.
