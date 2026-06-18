# skills

Bassel Al-Sayed's shareable [Claude Code](https://code.claude.com) agent skills.
Each skill lives in its own folder and is installable two ways: as a Claude Code
**plugin marketplace**, or via the **`npx skills`** CLI.

## Install

### Option A — Claude Code plugin marketplace (gets all skills)

In Claude Code:

```
/plugin marketplace add basselalsayed/skills
/plugin install skills@skills
```

This installs the whole bundle as one plugin.

### Option B — `npx skills` ([vercel-labs/skills](https://github.com/vercel-labs/skills))

```sh
# List available skills
npx skills add basselalsayed/skills --list

# Install everything
npx skills add basselalsayed/skills

# Install one skill, targeting Claude Code
npx skills add basselalsayed/skills --skill example-skill -a claude-code
```

## Repository layout

```
skills/
├── .claude-plugin/
│   ├── marketplace.json   # marketplace listing the bundle plugin
│   └── plugin.json        # the "skills" plugin; skills[] generated
├── skills/
│   └── <skill-name>/
│       └── SKILL.md       # one folder per skill
└── scripts/
    └── sync-skills.mjs    # regenerates skills[] from skills/
```

The `skills/<name>/SKILL.md` layout is what both Claude's marketplace and
`npx skills` discover, so each skill has a single copy on disk serving both
install paths.

## Available skills

| Skill | What it does |
| --- | --- |
| `backend-architect` | Enforces clean-architecture (SOLID/DIP) patterns for an async FastAPI backend — use cases, repositories, Unit of Work, DI, i18n, tests. |
| `example-skill` | Template + authoring reference for creating new skills in this repo. |

`backend-architect` is also this repo's example of **progressive disclosure**: a
lean `SKILL.md` index plus `references/*.md` files that Claude loads only when a
given concern is relevant — the recommended pattern for any skill whose content
grows past a page.

## Add a new skill

1. Copy `skills/example-skill/` to `skills/<your-skill-name>/`.
2. Edit the YAML frontmatter — `name` (must match the folder) and `description`
   are required; `allowed-tools` is optional.
3. Write the skill body (what it does, when to use it, steps, examples).
4. Register it in the manifests:
   ```sh
   node scripts/sync-skills.mjs
   ```
5. Commit and push.

To verify manifests are in sync (e.g. in CI):

```sh
node scripts/sync-skills.mjs --check
```

## License

[MIT](./LICENSE) © Bassel Al-Sayed
