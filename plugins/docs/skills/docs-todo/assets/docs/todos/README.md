# Todos

Deferred work: one committed file per item, deleted by the commit that ships
it.

## Format

`docs/todos/<slug>.md`:

```markdown
# <title>
- Created: DD-MM-YYYY · Origin: F-104 / ADR-0007 / commit abc123
- Why deferred: ...
## What to do
```

## Rules

- Every todo is linked from the doc that deferred it (a feature doc's
  `Deferred:` line or `## Open questions`, an ADR, or a design doc).
- The shipping commit deletes the file, removes live links to it, and names
  the slug (plain text) in its changelog entry. A dangling link fails
  `check-docs`.
