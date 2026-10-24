# AGENTS.md section for the `docs-*` skills

All `docs-*` skills share one section in the guidance file, between
`<!-- docs-skills:start -->` and `<!-- docs-skills:end -->`. Each skill owns a
marker line (`<!-- docs-<name> -->`) and the row(s) under it. With all three
skills inserted, the section is exactly:

```markdown
<!-- docs-skills:start -->
## Docs
Conventions for `docs/` come from the `docs-*` skills (vendored under `.agents/skills/`). Read `docs/README.md` for the map.
| Need | Read | Rule |
| --- | --- | --- |
<!-- docs-features -->
| Project invariants | `docs/principles.md` | Read before planning any feature |
| What exists / is planned | `docs/features/README.md` | Row → feature doc → only the linked ADR/design. "Current behaviour" is what ships; "Proposed changes" is approved work. Update on ship with evidence. Follow `docs-features` |
| Why something was decided | `docs/adr/README.md` | Significant decisions get a MADR ADR; amend or supersede rather than duplicate |
| Technical designs | `docs/design/README.md` | One file per design, linked from a feature doc |
| An approved plan | the plan file | Convert into docs before implementation (features, ADRs, designs, todos). The plan file is not the record. Follow `docs-features` |
<!-- docs-changelog -->
| What changed | `docs/changelog/DD-MM-YYYY.md` | EVERY in-scope commit appends an entry, staged in the same commit. Follow `docs-changelog` |
<!-- docs-todo -->
| Deferred work | `docs/todos/` | Deferred features/fixes become a committed file; delete when shipped. Follow `docs-todo` |
<!-- docs-skills:end -->
```

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

The `<!-- docs-features -->` marker and the five rows under it in the full
section above.

## Placement

Blocks keep a fixed order inside the section: `docs-features`,
`docs-changelog`, `docs-todo`. This block is first: insert it immediately
after the table head (`| --- | --- | --- |`). If `<!-- docs-features -->`
already exists, change nothing. The section stays at most 20 lines.
