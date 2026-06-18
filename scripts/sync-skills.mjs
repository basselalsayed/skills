#!/usr/bin/env node
// Regenerates the `skills[]` arrays in .claude-plugin/plugin.json and
// .claude-plugin/marketplace.json from the contents of skills/.
// Validates that every skill folder has a SKILL.md with `name` + `description`
// frontmatter. Idempotent: running twice with no skill changes yields no diff.
//
// Usage:  node scripts/sync-skills.mjs [--check]
//   --check  exit non-zero if files are out of sync (for CI), do not write.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(ROOT, "skills");
const PLUGIN_JSON = join(ROOT, ".claude-plugin", "plugin.json");
const MARKETPLACE_JSON = join(ROOT, ".claude-plugin", "marketplace.json");
const CHECK = process.argv.includes("--check");

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

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

function discoverSkills() {
  if (!existsSync(SKILLS_DIR)) fail(`skills/ directory not found`);
  const names = readdirSync(SKILLS_DIR)
    .filter((n) => !n.startsWith(".") && statSync(join(SKILLS_DIR, n)).isDirectory())
    .sort();

  const skills = [];
  for (const name of names) {
    const skillMd = join(SKILLS_DIR, name, "SKILL.md");
    if (!existsSync(skillMd)) fail(`skills/${name}: missing SKILL.md`);
    const fm = parseFrontmatter(readFileSync(skillMd, "utf8"), `skills/${name}/SKILL.md`);
    if (!fm.name) fail(`skills/${name}/SKILL.md: frontmatter missing 'name'`);
    if (!fm.description) fail(`skills/${name}/SKILL.md: frontmatter missing 'description'`);
    if (fm.name !== name) fail(`skills/${name}/SKILL.md: name '${fm.name}' must match folder '${name}'`);
    skills.push(`./skills/${name}`);
  }
  if (skills.length === 0) fail(`no skills found under skills/`);
  return skills;
}

function syncFile(path, mutate) {
  const before = readFileSync(path, "utf8");
  const json = JSON.parse(before);
  mutate(json);
  const after = JSON.stringify(json, null, 2) + "\n";
  if (before === after) return false;
  if (CHECK) fail(`${path} is out of sync — run: node scripts/sync-skills.mjs`);
  writeFileSync(path, after);
  return true;
}

const skills = discoverSkills();

const changedPlugin = syncFile(PLUGIN_JSON, (j) => {
  j.skills = skills;
});
const changedMarket = syncFile(MARKETPLACE_JSON, (j) => {
  if (!Array.isArray(j.plugins) || j.plugins.length === 0) fail(`marketplace.json: no plugins[] entry`);
  j.plugins[0].skills = skills;
});

console.log(`✓ ${skills.length} skill(s): ${skills.map((s) => s.replace("./skills/", "")).join(", ")}`);
console.log(changedPlugin || changedMarket ? "✓ manifests updated" : "✓ manifests already in sync");
