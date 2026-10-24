# Skills

Bassel Al-Sayed's shareable backend and React Native skills, with dedicated
developer and reviewer agents for Claude Code and Codex.

## Install

### Claude Code plugin marketplace

In Claude Code:

```
/plugin marketplace add basselalsayed/skills
/plugin install skills@skills
```

This installs all skills and the four agents.

### Codex plugin marketplace

```sh
codex plugin marketplace add basselalsayed/skills
codex plugin add skills@skills
```

This installs the skill bundle. The repository also includes project-scoped
Codex custom agents under `.codex/agents/`; Codex discovers those when working
from a checkout of this repository.

### `npx skills` ([vercel-labs/skills](https://github.com/vercel-labs/skills))

```sh
# List available skills
npx skills add basselalsayed/skills --list

# Install everything
npx skills add basselalsayed/skills

# Install one skill, targeting Claude Code or Codex
npx skills add basselalsayed/skills --skill example-skill -a claude-code
npx skills add basselalsayed/skills --skill frontend-developer -a codex
```

## Repository layout

```
skills/
├── .agents/plugins/
│   └── marketplace.json   # Codex marketplace catalog
├── .claude-plugin/
│   ├── marketplace.json   # marketplace listing the bundle and docs plugins
│   └── plugin.json        # Claude Code plugin manifest
├── .codex-plugin/
│   └── plugin.json        # Codex plugin manifest
├── .codex/agents/
│   └── *.toml             # project-scoped Codex custom agents
├── agents/
│   └── *.md               # Claude Code plugin agents
├── skills/
│   └── <skill-name>/
│       └── SKILL.md       # one folder per skill
├── plugins/docs/          # the docs plugin (own manifests + skills/)
└── scripts/
    └── sync-skills.mjs    # regenerates skills[] from skills/ and plugins/*/skills/
```

The `skills/<name>/SKILL.md` layout is shared by Claude Code, Codex, and
`npx skills`, so each skill has a single source of truth.

## Available skills

| Skill | What it does |
| --- | --- |
| `backend-architect` | Enforces clean architecture for async Python backends — HTTP/Celery/CLI entrypoints, Dishka DI, atomic use cases, workflows, JWT auth, repositories, Unit of Work, i18n, and tests. |
| `example-skill` | Template + authoring reference for creating new skills in this repo. |
| `frontend-developer` | Enforces FSD, NativeWind, generated API, i18n, typed state, utility, and persistence patterns for React Native frontends. |
| `rebase` | Safely analyzes branch histories, chooses rebase or merge, protects the starting state, handles conflicts, and verifies the integration. |

`backend-architect` is also this repo's example of **progressive disclosure**: a
lean `SKILL.md` index plus `references/*.md` files that Claude loads only when a
given concern is relevant — the recommended pattern for any skill whose content
grows past a page.

## Available agents

Both Claude Code and Codex include developer and read-only reviewer roles:

| Agent | Role |
| --- | --- |
| `backend-developer` | Implements backend changes using `backend-architect`. |
| `backend-reviewer` | Reviews backend changes without editing files. |
| `frontend-developer` | Implements mobile frontend changes using `frontend-developer`. |
| `frontend-reviewer` | Reviews mobile frontend changes without editing files. |

Claude Code definitions live in the plugin-root `agents/` directory and are
listed in both Claude manifests. Codex definitions live in `.codex/agents/`.
Each skill also carries `agents/openai.yaml`, which provides Codex UI metadata
for that skill.

## Docs plugin

`plugins/docs/` is a second plugin, `docs`, separate from the root `skills`
bundle. Its three skills keep a project's `docs/` directory honest:

| Skill | What it does |
| --- | --- |
| `docs-changelog` | Per-day engineering journal: every commit appends an entry to `docs/changelog/DD-MM-YYYY.md`. Ships `scripts/check-changelog.mjs` (with `--self-test`). |
| `docs-todo` | Deferred work as one committed file per item in `docs/todos/`, deleted when shipped. |
| `docs-features` | Feature registry, feature docs (current vs proposed), MADR ADRs, design docs, and conversion of approved plans into them. Ships `scripts/check-docs.mjs`. |

On first use each skill asks before adding its row to a shared `## Docs`
section in `AGENTS.md` / `CLAUDE.md`; markers keep that idempotent.

For a project, vendor the skills so CI can run their scripts:

```sh
npx skills add basselalsayed/skills --skill docs-changelog -a claude-code
npx skills add basselalsayed/skills --skill docs-todo -a claude-code
npx skills add basselalsayed/skills --skill docs-features -a claude-code
```

For personal use in Claude Code:

```
/plugin marketplace add basselalsayed/skills
/plugin install docs@skills
```

The skills are then invoked as `/docs:docs-<name>`. A plugin-cache install is
not a stable path for CI; vendor instead.

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
