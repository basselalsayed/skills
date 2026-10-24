#!/usr/bin/env node
// Regenerates the `skills[]` arrays in every plugin manifest and in the
// matching .claude-plugin/marketplace.json entry from the skill folders on disk:
//   - the root plugin (.claude-plugin/plugin.json) from skills/
//   - each nested plugin (plugins/<p>/.claude-plugin/plugin.json) from
//     plugins/<p>/skills/
// Marketplace entries are matched by plugin `name`; paths stay relative to the
// plugin root (`./skills/<name>`).
// Validates that every skill folder has a SKILL.md with `name` + `description`
// frontmatter. Idempotent: running twice with no skill changes yields no diff.
//
// Usage:  node scripts/sync-skills.mjs [--check]
//   --check  exit non-zero if files are out of sync (for CI), do not write.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGINS_DIR = join(ROOT, "plugins");
const MARKETPLACE_JSON = join(ROOT, ".claude-plugin", "marketplace.json");
const CHECK = process.argv.includes("--check");

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const rel = (p) => relative(ROOT, p) || ".";

// Minimal YAML frontmatter parser — only reads top-level scalar keys we need.
function parseFrontmatter(md, file) {
  if (!md.startsWith("---")) fail(`${file}: missing YAML frontmatter`);
  const end = md.indexOf("\n---", 3);
  if (end === -1) fail(`${file}: unterminated frontmatter block`);
  const block = md.slice(3, end);
  const out = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const subdirs = (dir) =>
  readdirSync(dir)
    .filter((n) => !n.startsWith(".") && statSync(join(dir, n)).isDirectory())
    .sort();

function discoverSkills(pluginRoot) {
  const skillsDir = join(pluginRoot, "skills");
  if (!existsSync(skillsDir)) fail(`${rel(skillsDir)}/ directory not found`);

  const skills = [];
  for (const name of subdirs(skillsDir)) {
    const dir = rel(join(skillsDir, name));
    const skillMd = join(skillsDir, name, "SKILL.md");
    if (!existsSync(skillMd)) fail(`${dir}: missing SKILL.md`);
    const fm = parseFrontmatter(readFileSync(skillMd, "utf8"), `${dir}/SKILL.md`);
    if (!fm.name) fail(`${dir}/SKILL.md: frontmatter missing 'name'`);
    if (!fm.description) fail(`${dir}/SKILL.md: frontmatter missing 'description'`);
    if (fm.name !== name) fail(`${dir}/SKILL.md: name '${fm.name}' must match folder '${name}'`);
    skills.push(`./skills/${name}`);
  }
  if (skills.length === 0) fail(`no skills found under ${rel(skillsDir)}/`);
  return skills;
}

function syncFile(path, mutate) {
  const before = readFileSync(path, "utf8");
  const json = JSON.parse(before);
  mutate(json);
  const after = JSON.stringify(json, null, 2) + "\n";
  if (before === after) return false;
  if (CHECK) fail(`${rel(path)} is out of sync — run: node scripts/sync-skills.mjs`);
  writeFileSync(path, after);
  return true;
}

// The root plugin first, then every plugins/<p>/ that has a Claude manifest.
const pluginRoots = [ROOT];
if (existsSync(PLUGINS_DIR)) {
  for (const p of subdirs(PLUGINS_DIR)) {
    if (existsSync(join(PLUGINS_DIR, p, ".claude-plugin", "plugin.json"))) {
      pluginRoots.push(join(PLUGINS_DIR, p));
    }
  }
}

const plugins = pluginRoots.map((pluginRoot) => {
  const pluginJson = join(pluginRoot, ".claude-plugin", "plugin.json");
  const { name } = JSON.parse(readFileSync(pluginJson, "utf8"));
  if (!name) fail(`${rel(pluginJson)}: missing 'name'`);
  return { name, pluginJson, skills: discoverSkills(pluginRoot) };
});

let changed = false;
for (const { pluginJson, skills } of plugins) {
  changed =
    syncFile(pluginJson, (j) => {
      j.skills = skills;
    }) || changed;
}
changed =
  syncFile(MARKETPLACE_JSON, (j) => {
    if (!Array.isArray(j.plugins) || j.plugins.length === 0) fail(`marketplace.json: no plugins[] entry`);
    for (const { name, skills } of plugins) {
      const entry = j.plugins.find((p) => p.name === name);
      if (!entry) fail(`marketplace.json: no plugins[] entry named '${name}'`);
      entry.skills = skills;
    }
  }) || changed;

for (const { name, skills } of plugins) {
  console.log(`✓ ${name}: ${skills.length} skill(s): ${skills.map((s) => s.replace("./skills/", "")).join(", ")}`);
}
console.log(changed ? "✓ manifests updated" : "✓ manifests already in sync");
