---
name: example-skill
description: "Template and reference for authoring a new skill in this repo. Copy this folder, rename it, and rewrite the frontmatter and body. Triggers on phrases describing what your skill does — be specific so Claude knows when to invoke it."
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
---

# Example Skill

This is a starter skill that doubles as the authoring template for the
`bsas-skills` repo. Delete this content and replace it with your own when you
copy the folder.

## Frontmatter reference

Every skill is a folder containing a `SKILL.md` with YAML frontmatter:

| Field           | Required | Notes                                                                 |
| --------------- | -------- | --------------------------------------------------------------------- |
| `name`          | yes      | kebab-case, must match the folder name                                |
| `description`   | yes      | one line; describes what it does AND when to trigger it               |
| `allowed-tools` | no       | list of tools; supports scoped perms like `Bash(git:*)`              |

Both Claude Code's plugin marketplace and `npx skills` (vercel-labs/skills)
discover skills by reading `SKILL.md` frontmatter, so `name` + `description`
are the only hard requirements.

## How to add a new skill

1. Copy `skills/example-skill/` to `skills/<your-skill-name>/`.
2. Rename and rewrite the frontmatter (`name` must match the new folder).
3. Write the skill body: what it does, when to use it, steps, examples.
4. Run `node scripts/sync-skills.mjs` to register it in the plugin manifest.
5. Commit.

## Body conventions

Write the body as instructions to Claude: purpose, when to use, concrete
steps, and good/bad examples. Keep it focused — one skill, one job.
