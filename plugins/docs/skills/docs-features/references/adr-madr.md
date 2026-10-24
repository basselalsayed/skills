# ADRs (MADR 4.0)

`docs/adr/NNNN-title-with-dashes.md`, indexed in `docs/adr/README.md`
(number, title, status, date). Copy `docs/adr/template.md` to start.

```markdown
---
status: proposed | accepted | rejected | deprecated | superseded by ADR-NNNN
date: DD-MM-YYYY          # the decision date, not the reformatting date
decision-makers: <names>
---
# ADR-NNNN: short title naming the problem and the solution
## Context and Problem Statement
## Decision Drivers            (optional)
## Considered Options
## Decision Outcome
Chosen option: "...", because ...
### Consequences               (good / bad)
### Confirmation               (required when accepted: the check, test, lint or review that fails if violated)
## Pros and Cons of the Options (optional)
## More Information            (feature IDs, design docs, task IDs, supersession, source plan section)
```

## Rules

- **Numbers** are assigned at write time from `ls docs/adr`: the next free
  number. Never reuse or renumber an existing file.
- **Significant decisions only.** Routine choices live in design docs. Not one
  ADR per choice.
- **Amend or supersede, never duplicate.** A change to an existing decision
  edits that ADR (amendment noted under More Information) or adds a new ADR
  and sets the old one to `superseded by ADR-NNNN`.
- **Accepted needs Confirmation**: name the check that fails if the decision
  is violated (a lint, xtask, test or review step).
- **Reformatting an existing ADR** into MADR keeps its content verbatim under
  the new headings, its original decision date and its status meaning (a gate
  that is open but blocked becomes `status: proposed` with the gate evidence
  verbatim under Confirmation). Task-ID references stay.
- Optional sections stay optional; omit rather than pad.
- The index lists every ADR file with the same status as its frontmatter.
