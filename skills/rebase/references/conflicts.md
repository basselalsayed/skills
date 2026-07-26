# Conflict handling

For every conflict:

1. List unresolved paths and classify each as textual, add/add, modify/delete, rename, binary, submodule, generated artifact, lockfile, migration, or semantic.
2. Inspect the base, ours, theirs, relevant commits, surrounding code, tests, and call sites.
3. During rebase, remember that Git’s “ours” and “theirs” labels can feel reversed; reason from commits and contents, not labels.
4. Resolve only when intent is unambiguous:
   - Preserve compatible edits from both sides.
   - Follow obvious renames with unchanged semantics.
   - Update mechanical references consistently.
   - Regenerate generated artifacts with the canonical tool.
5. Stage only intended paths and run focused validation before continuing when practical.

Pause and ask when:

- Both behaviors are valid but mutually exclusive.
- A modify/delete conflict leaves product intent unclear.
- Migrations, schema ordering, public APIs, security rules, or data semantics conflict.
- A binary or submodule choice lacks an authoritative source.
- Resolution would drop or substantially redesign either side.

Explain the conflict in domain terms, viable choices, consequences, and affected files. Keep the operation paused until the user decides.

## Lockfile fast path

Treat lockfiles as generated output. Once authoritative manifests such as `package.json`, workspace manifests, `pyproject.toml`, or equivalents are correctly resolved, consider dependency intent settled. Do not inspect or manually merge lockfile hunks.

1. Resolve all dependency manifests and package-manager configuration first. Ask only when dependency versions, sources, or workspace intent conflict semantically.
2. Identify the canonical package manager, pinned version, workspace scope, and regeneration command.
3. Remove the conflicted lockfile and regenerate it from the resolved manifests.
4. Prefer a lockfile-only operation and disable lifecycle scripts when safely supported.
5. Stage the manifests and lockfile. Inspect summary statistics only for unexpected upgrades, source changes, workspace loss, or excessive churn.
6. Run the package manager’s lockfile or install consistency check and relevant dependency validation.

If credentials, network, or toolchain availability blocks regeneration, report that environmental blocker. Never fall back to a token-heavy manual merge or ask the user to choose lockfile hunks.
