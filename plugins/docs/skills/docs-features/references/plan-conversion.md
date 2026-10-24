# Plan conversion

Triggered when the user approves a plan from any skill or tool (a planning
skill, a consensus plan, a spec, a design review). The plan file is not the
record; `docs/` is. Convert before writing any implementation code.

## Procedure

1. **Registry.** One row in `docs/features/README.md` per feature the plan
   introduces or changes, with `Depends on` filled and the plan's task IDs in
   `Plan tasks`.
2. **Change blocks.** In each affected feature doc, a
   `### Change: <slug> (approved DD-MM-YYYY)` block under
   `## Proposed changes`, holding the plan's requirements as
   Requirement/Scenario blocks (see [feature-format.md](feature-format.md)).
   New features get a new doc with a `### Change: initial (…)` block.
3. **ADRs.** A MADR ADR only for significant new decisions; amend or supersede
   existing ADRs otherwise (see [adr-madr.md](adr-madr.md)).
4. **Design docs.** One `docs/design/<slug>.md` per technical design section
   of the plan, linked from the feature docs it serves and listed in
   `docs/design/README.md`. Condense prose; keep every invariant, number,
   threshold, sequence and owner.
5. **Todos.** One `docs/todos/<slug>.md` per deferred item or open question,
   linked from the feature doc's `Deferred:` line or `## Open questions`
   (follow `docs-todo`).
6. **Changelog.** The conversion commit's changelog entry lists the IDs
   created (feature IDs, ADR numbers, todo slugs).

Conversion is its own commit, before the first implementation commit. Run
`scripts/check-docs.mjs` before committing it.

## Proportionality

A plan touching one feature produces one change block and no new ADR unless a
decision changed. Do not turn a small fix into a docs project.

## Conflicts

When the plan contradicts existing docs, code or ADRs, apply
[precedence-and-ledger.md](precedence-and-ledger.md). Never let a plan
silently override implemented, tested behaviour.

## Large plans

A plan big enough to replace earlier planning (many features, many sections)
is **absorbed** rather than converted piecemeal: keep the source immutable
until a migration ledger proves every normative unit landed somewhere (see
[precedence-and-ledger.md](precedence-and-ledger.md)).
