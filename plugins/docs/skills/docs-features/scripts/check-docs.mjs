#!/usr/bin/env node
// Consistency check for a docs/ tree laid out by the docs-* skills.
//
// Usage:  node check-docs.mjs [<root>]      (root defaults to the cwd)
//         node check-docs.mjs --self-test
//
// Checks (each failure prints `file:line: message`):
//   - markdown links under docs/ resolve, including #anchors (GitHub slugs)
//   - docs/features/README.md registry rows <-> feature docs: matching ID and
//     status, unique IDs, status vocabulary, a Depends on value, a link
//   - each T-ID (T0.1, T1.19, ...) in the registry Plan tasks column is in one row
//   - built features carry an Evidence line
//   - feature docs have >=1 Requirement; every `#### Requirement:` has a
//     `##### Scenario:` (optional in Phase 2/3 feature docs)
//   - docs/adr/NNNN-*.md <-> docs/adr/README.md index (status and date match),
//     MADR frontmatter (status, date, decision-makers) and headings, and
//     `### Confirmation` when accepted
//   - no `.omc/` or `archive/ralplan` references under docs/ or in
//     AGENTS.md, CLAUDE.md, .claude/CLAUDE.md
//   - every todo is linked from somewhere other than docs/todos/README.md
//   - docs/migration/ralplan-v20-ledger.md (if present): no empty cells, every
//     destination resolves, dispositions well-formed, conflicts cite rule a-d
//
// Exit 0 when clean, 1 on any failure, 2 on usage errors.

import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_NAME = basename(dirname(SCRIPT_DIR));
const STATUSES = ["planned", "in-progress", "built", "deferred", "dropped"];
const ADR_STATUS = /^(proposed|accepted|rejected|deprecated|superseded by ADR-\d{4})$/i;
const ADR_HEADINGS = [
  [2, "Context and Problem Statement"],
  [2, "Considered Options"],
  [2, "Decision Outcome"],
  [3, "Consequences"],
  [2, "More Information"],
];
const GUIDANCE_FILES = ["AGENTS.md", "CLAUDE.md", ".claude/CLAUDE.md"];
const FORBIDDEN = /\.omc\/|archive\/ralplan/;
const TEXT_EXT = /\.(md|markdown|txt|ya?ml|json|toml)$/i;
const LEDGER = "docs/migration/ralplan-v20-ledger.md";
const DASH = /^[—–-]+$/;

// ---------- markdown parsing ----------

// GitHub heading slug: rendered text, lowercased, punctuation removed, spaces -> "-".
function slugText(text) {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[`*]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
    .replace(/ /g, "-");
}

function stripInlineCode(line) {
  return line.replace(/(`+)[\s\S]*?\1/g, (m) => " ".repeat(m.length));
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim());
}

const isSeparatorRow = (cells) => cells.every((c) => /^:?-{3,}:?$/.test(c));

function cleanCell(cell) {
  return cell.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[`*]/g, "").replace(/\s+/g, " ").trim();
}

const cache = new Map();
function parse(abs) {
  if (cache.has(abs)) return cache.get(abs);
  const text = readFileSync(abs, "utf8");
  const lines = text.split(/\r?\n/);
  const code = new Array(lines.length).fill(false);
  const headings = [];
  const anchors = new Set();
  const links = [];
  const tables = [];
  const seen = new Map();
  let fence = null;
  let frontmatter = lines[0] === "---";
  let table = null;
  lines.forEach((line, i) => {
    if (frontmatter) {
      code[i] = true;
      if (i > 0 && line === "---") frontmatter = false;
      return;
    }
    const f = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      code[i] = true;
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      return;
    }
    if (f) {
      fence = f[1];
      code[i] = true;
      return;
    }
    const plain = stripInlineCode(line);
    const h = line.match(/^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/);
    if (h) {
      const base = slugText(h[2]);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const slug = n === 0 ? base : `${base}-${n}`;
      headings.push({ level: h[1].length, text: h[2].trim(), line: i + 1, slug });
      anchors.add(slug);
    }
    for (const m of plain.matchAll(/<a\s[^>]*(?:id|name)="([^"]+)"/g)) anchors.add(m[1]);
    for (const m of plain.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) links.push({ target: m[1], line: i + 1 });
    const ref = plain.match(/^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s|$)/);
    if (ref) links.push({ target: ref[1], line: i + 1 });
    if (/^\s*\|/.test(line)) {
      const cells = splitRow(line);
      if (!table) {
        const heading = [...headings].reverse().find((x) => x.level <= 2);
        table = { header: cells, rows: [], line: i + 1, heading: heading?.text ?? "" };
        tables.push(table);
      } else if (!isSeparatorRow(cells)) {
        table.rows.push({ cells, line: i + 1, raw: line });
      }
    } else {
      table = null;
    }
  });
  const doc = { abs, text, lines, code, headings, anchors, links, tables };
  cache.set(abs, doc);
  return doc;
}

function frontmatterOf(doc) {
  if (doc.lines[0] !== "---") return null;
  const end = doc.lines.indexOf("---", 1);
  if (end === -1) return null;
  const out = {};
  for (const l of doc.lines.slice(1, end)) {
    const m = l.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

// "- Status: planned · Phase: 0 · Plan tasks: T0.1" -> { status, phase, "plan tasks" }
function bulletFields(doc, key) {
  const i = doc.lines.findIndex((l, n) => !doc.code[n] && new RegExp(`^\\s*[-*]\\s+${key}:`, "i").test(l));
  if (i === -1) return null;
  const fields = { line: i + 1 };
  for (const part of doc.lines[i].replace(/^\s*[-*]\s+/, "").split("·")) {
    const m = part.match(/^\s*([^:]+?)\s*:\s*(.*?)\s*$/);
    if (m) fields[m[1].toLowerCase()] = m[2];
  }
  return fields;
}

// ---------- the check ----------

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

export function checkDocs(rootArg) {
  cache.clear();
  const root = resolve(rootArg);
  const errors = [];
  const rel = (abs) => relative(root, abs).split(sep).join("/");
  const err = (abs, line, msg) => errors.push(`${rel(abs)}:${line}: ${msg}`);
  const docsDir = join(root, "docs");
  if (!existsSync(docsDir)) {
    errors.push(`docs:1: no docs/ directory under ${root}`);
    return errors;
  }
  const files = walk(docsDir);
  const mdFiles = files.filter((f) => f.endsWith(".md"));
  const guidance = GUIDANCE_FILES.map((f) => join(root, f)).filter((f) => existsSync(f));
  const inDir = (abs, d) => dirname(abs) === join(docsDir, d);

  // Forbidden references.
  const seenReal = new Set();
  for (const abs of [...files.filter((f) => TEXT_EXT.test(f)), ...guidance]) {
    const real = realpathSync(abs);
    if (seenReal.has(real)) continue;
    seenReal.add(real);
    readFileSync(abs, "utf8")
      .split(/\r?\n/)
      .forEach((l, i) => {
        const m = l.match(FORBIDDEN);
        if (m) err(abs, i + 1, `forbidden reference "${m[0]}" (docs must not point at .omc/ or the archive branch)`);
      });
  }

  // Links and anchors. `linkedFrom` maps target file -> set of source files.
  const linkedFrom = new Map();
  const resolveLink = (fromAbs, target) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return null;
    const hash = target.indexOf("#");
    let path = hash === -1 ? target : target.slice(0, hash);
    let anchor = hash === -1 ? null : target.slice(hash + 1);
    try {
      path = decodeURIComponent(path);
      if (anchor) anchor = decodeURIComponent(anchor);
    } catch {}
    const abs = path === "" ? fromAbs : path.startsWith("/") ? join(root, path) : resolve(dirname(fromAbs), path);
    return { abs, anchor };
  };
  const checkTarget = (fromAbs, line, target, what = "link") => {
    const r = resolveLink(fromAbs, target);
    if (!r) return null;
    if (!existsSync(r.abs)) {
      err(fromAbs, line, `broken ${what}: ${target} (no such file)`);
      return null;
    }
    if (r.anchor && statSync(r.abs).isFile() && r.abs.endsWith(".md") && !parse(r.abs).anchors.has(r.anchor)) {
      err(fromAbs, line, `broken ${what}: ${target} (no heading with anchor #${r.anchor} in ${rel(r.abs)})`);
    }
    return r.abs;
  };
  for (const abs of [...mdFiles, ...guidance]) {
    const checked = mdFiles.includes(abs);
    for (const { target, line } of parse(abs).links) {
      const to = checked ? checkTarget(abs, line, target) : resolveLink(abs, target)?.abs;
      if (to && to !== abs) {
        if (!linkedFrom.has(to)) linkedFrom.set(to, new Set());
        linkedFrom.get(to).add(abs);
      }
    }
  }

  // Requirement -> Scenario.
  const requirements = (doc) => doc.headings.filter((h) => h.level === 4 && /^Requirement:/i.test(h.text));
  const checkScenarios = (doc) => {
    for (const req of requirements(doc)) {
      const next = doc.headings.find((h) => h.line > req.line && h.level <= 4);
      const hasScenario = doc.headings.some(
        (h) => h.line > req.line && (!next || h.line < next.line) && h.level === 5 && /^Scenario:/i.test(h.text),
      );
      if (!hasScenario) err(doc.abs, req.line, `"${req.text}" has no "##### Scenario:"`);
    }
  };

  // Feature docs.
  const featureDocs = new Map(); // id -> { abs, status, line }
  const featureFiles = mdFiles.filter((f) => inDir(f, "features") && basename(f) !== "README.md");
  for (const abs of featureFiles) {
    const doc = parse(abs);
    const h1 = doc.headings.find((h) => h.level === 1);
    const id = h1?.text.match(/^([A-Z]+-\d+)\s*:\s*\S/)?.[1];
    if (!id) {
      err(abs, h1?.line ?? 1, `feature doc needs a "# F-NNN: Name" heading`);
      continue;
    }
    if (featureDocs.has(id)) err(abs, h1.line, `duplicate feature ID ${id} (also ${rel(featureDocs.get(id).abs)})`);
    const fields = bulletFields(doc, "Status");
    const status = fields?.status?.toLowerCase();
    if (!fields) err(abs, 1, `missing "- Status: ... · Phase: ..." line`);
    else if (!STATUSES.includes(status)) err(abs, fields.line, `status "${fields.status}" not in ${STATUSES.join("|")}`);
    const phase = fields?.phase ?? "";
    if (status === "built") {
      const ev = bulletFields(doc, "Evidence");
      const value = ev?.evidence ?? "";
      if (!value || DASH.test(value) || /^\(/.test(value) || /^none$/i.test(value)) {
        err(abs, ev?.line ?? fields.line, `${id} is built but has no Evidence (test, CI job or commit)`);
      }
    }
    if (requirements(doc).length === 0) err(abs, h1.line, `${id} has no "#### Requirement:"`);
    if (!/^[23](\.|\b)/.test(phase.trim())) checkScenarios(doc);
    if (!featureDocs.has(id)) featureDocs.set(id, { abs, status, line: h1.line });
  }
  for (const abs of mdFiles.filter((f) => !featureFiles.includes(f))) checkScenarios(parse(abs));

  // Registry.
  const registryAbs = join(docsDir, "features", "README.md");
  const registered = new Set();
  if (existsSync(registryAbs)) {
    const reg = parse(registryAbs);
    const rowIds = new Map();
    const taskRows = new Map();
    for (const t of reg.tables.filter((t) => /^Phase\b/i.test(t.heading))) {
      const col = (name) => t.header.findIndex((c) => cleanCell(c).toLowerCase().startsWith(name));
      const cols = {
        id: col("id"),
        status: col("status"),
        depends: col("depends"),
        docs: col("docs"),
        tasks: col("plan tasks"),
      };
      for (const [k, v] of Object.entries(cols)) {
        if (v === -1) err(registryAbs, t.line, `registry table under "${t.heading}" has no "${k}" column`);
      }
      if (Object.values(cols).includes(-1)) continue;
      for (const row of t.rows) {
        const cell = (k) => row.cells[cols[k]] ?? "";
        const id = cleanCell(cell("id"));
        const status = cleanCell(cell("status")).toLowerCase();
        if (!/^[A-Z]+-\d+$/.test(id)) {
          err(registryAbs, row.line, `row ID "${id}" is not like F-001`);
          continue;
        }
        if (rowIds.has(id)) err(registryAbs, row.line, `duplicate registry ID ${id} (also line ${rowIds.get(id)})`);
        rowIds.set(id, row.line);
        registered.add(id);
        if (!STATUSES.includes(status)) err(registryAbs, row.line, `${id}: status "${status}" not in ${STATUSES.join("|")}`);
        if (!cleanCell(cell("depends"))) err(registryAbs, row.line, `${id}: empty Depends on (use —)`);
        if (!/\]\(/.test(row.raw)) err(registryAbs, row.line, `${id}: row has no link`);
        for (const tid of new Set(cell("tasks").match(/\bT\d+\.\d+[a-z]?\b/g) ?? [])) {
          if (taskRows.has(tid)) err(registryAbs, row.line, `${tid} is in the Plan tasks of ${taskRows.get(tid)} and ${id}`);
          else taskRows.set(tid, id);
        }
        const doc = featureDocs.get(id);
        const docLinks = [...cell("docs").matchAll(/\]\(\s*<?([^)\s>#]+)/g)]
          .map((m) => resolve(dirname(registryAbs), m[1]))
          .filter((p) => dirname(p) === join(docsDir, "features") && p.endsWith(".md") && basename(p) !== "README.md");
        if (docLinks.length === 0) {
          err(registryAbs, row.line, `${id}: Docs cell has no link to a feature doc in docs/features/`);
        } else if (!doc) {
          if (docLinks.every((p) => existsSync(p))) err(registryAbs, row.line, `${id}: no feature doc has heading "# ${id}: ..."`);
        } else {
          if (!docLinks.includes(doc.abs)) err(registryAbs, row.line, `${id}: Docs links ${docLinks.map(rel).join(", ")} but ${id} is ${rel(doc.abs)}`);
          if (doc.status && STATUSES.includes(status) && doc.status !== status) {
            err(registryAbs, row.line, `${id}: registry status "${status}" != "${doc.status}" in ${rel(doc.abs)}:${doc.line}`);
          }
        }
      }
    }
    for (const [id, doc] of featureDocs) {
      if (!registered.has(id)) err(doc.abs, doc.line, `${id} has no row in docs/features/README.md`);
    }
  } else if (featureFiles.length > 0) {
    errors.push(`docs/features/README.md:1: registry missing but docs/features/ has feature docs`);
  }

  // ADRs.
  const adrFiles = mdFiles.filter((f) => inDir(f, "adr") && /^\d{4}-.+\.md$/.test(basename(f)));
  const adrIndexAbs = join(docsDir, "adr", "README.md");
  const indexRows = new Map(); // abs -> { line, status, date }
  if (existsSync(adrIndexAbs)) {
    const idx = parse(adrIndexAbs);
    for (const t of idx.tables) {
      const col = (name) => t.header.findIndex((c) => cleanCell(c).toLowerCase() === name);
      const [sCol, dCol] = [col("status"), col("date")];
      for (const row of t.rows) {
        for (const m of row.raw.matchAll(/\]\(\s*<?([^)\s>#]+)/g)) {
          const p = resolve(dirname(adrIndexAbs), m[1]);
          if (!/^\d{4}-.+\.md$/.test(basename(p))) continue;
          indexRows.set(p, {
            line: row.line,
            status: sCol === -1 ? null : cleanCell(row.cells[sCol] ?? ""),
            date: dCol === -1 ? null : cleanCell(row.cells[dCol] ?? ""),
          });
        }
      }
    }
    for (const { target, line } of idx.links) {
      const r = resolveLink(adrIndexAbs, target);
      if (r && /^\d{4}-.+\.md$/.test(basename(r.abs)) && !indexRows.has(r.abs)) indexRows.set(r.abs, { line });
    }
  } else if (adrFiles.length > 0) {
    errors.push(`docs/adr/README.md:1: ADR index missing but docs/adr/ has ADRs`);
  }
  const numbers = new Map();
  for (const abs of adrFiles) {
    const doc = parse(abs);
    const num = basename(abs).slice(0, 4);
    if (numbers.has(num)) err(abs, 1, `ADR number ${num} reused (also ${rel(numbers.get(num))})`);
    numbers.set(num, abs);
    const fm = frontmatterOf(doc);
    if (!fm) {
      err(abs, 1, `missing MADR frontmatter (--- status/date/decision-makers ---)`);
    } else {
      for (const k of ["status", "date", "decision-makers"]) if (!fm[k]) err(abs, 1, `frontmatter has no "${k}"`);
      if (fm.status && !ADR_STATUS.test(fm.status)) err(abs, 1, `status "${fm.status}" not proposed|accepted|rejected|deprecated|superseded by ADR-NNNN`);
      if (fm.date && !/^\d{2}-\d{2}-\d{4}$/.test(fm.date)) err(abs, 1, `date "${fm.date}" is not DD-MM-YYYY`);
    }
    const h1 = doc.headings.find((h) => h.level === 1);
    if (!h1 || !new RegExp(`^ADR-${num}\\s*:\\s*\\S`).test(h1.text)) err(abs, h1?.line ?? 1, `title must be "# ADR-${num}: ..."`);
    for (const [level, text] of ADR_HEADINGS) {
      if (!doc.headings.some((h) => h.level === level && h.text === text)) err(abs, 1, `missing heading "${"#".repeat(level)} ${text}"`);
    }
    if (fm?.status?.toLowerCase() === "accepted" && !doc.headings.some((h) => h.level === 3 && h.text === "Confirmation")) {
      err(abs, 1, `accepted ADR needs "### Confirmation"`);
    }
    const entry = indexRows.get(abs);
    if (existsSync(adrIndexAbs) && !entry) err(abs, 1, `not listed in docs/adr/README.md`);
    if (entry && fm) {
      if (entry.status != null && entry.status.toLowerCase() !== (fm.status ?? "").toLowerCase()) {
        err(adrIndexAbs, entry.line, `status "${entry.status}" != "${fm.status}" in ${rel(abs)}`);
      }
      if (entry.date != null && entry.date !== fm.date) err(adrIndexAbs, entry.line, `date "${entry.date}" != "${fm.date}" in ${rel(abs)}`);
    }
  }

  // Todos.
  for (const abs of mdFiles.filter((f) => inDir(f, "todos") && basename(f) !== "README.md")) {
    const from = [...(linkedFrom.get(abs) ?? [])].filter((f) => f !== join(docsDir, "todos", "README.md"));
    if (from.length === 0) err(abs, 1, `todo is not linked from any feature doc, ADR or design doc`);
  }

  // Migration ledger.
  const ledgerAbs = join(root, LEDGER);
  if (existsSync(ledgerAbs)) {
    const doc = parse(ledgerAbs);
    for (const t of doc.tables.filter((t) => /^source/i.test(cleanCell(t.header[0] ?? "")))) {
      const names = t.header.map(cleanCell);
      for (const row of t.rows) {
        if (row.cells.length !== names.length) {
          err(ledgerAbs, row.line, `row has ${row.cells.length} cells, header has ${names.length}`);
          continue;
        }
        row.cells.forEach((c, i) => {
          if (!cleanCell(c)) err(ledgerAbs, row.line, `empty "${names[i]}" cell`);
        });
        const dest = row.cells[2] ?? "";
        const destText = cleanCell(dest);
        if (!destText) continue;
        if (/^todo:/i.test(destText)) {
          const slug = destText.replace(/^todo:\s*/i, "").replace(/\.md$/, "").trim();
          if (!existsSync(join(docsDir, "todos", `${slug}.md`))) err(ledgerAbs, row.line, `todo "${slug}" has no docs/todos/${slug}.md`);
        } else if (/^dropped:/i.test(destText)) {
          const sup = destText.match(/^dropped:\s*superseded by\s+(\S.*)$/i);
          if (!sup && !/^dropped:\s*review history$/i.test(destText)) {
            err(ledgerAbs, row.line, `disposition must be "dropped: superseded by <where>" or "dropped: review history"`);
          }
        } else {
          const targets = [
            ...[...dest.matchAll(/\]\(\s*<?([^)\s>]+)/g)].map((m) => ({ from: ledgerAbs, target: m[1] })),
            ...[...dest.replace(/\]\([^)]*\)/g, "").matchAll(/(?:^|[\s`(])(docs\/[^\s`)|,;<]+)/g)].map((m) => ({
              from: join(root, "_"),
              target: m[1],
            })),
          ];
          if (targets.length === 0) {
            err(ledgerAbs, row.line, `destination "${destText}" is neither docs/<path>#<anchor> nor todo:/dropped:`);
          }
          for (const { from, target } of targets) {
            const r = resolveLink(from, target);
            if (!r || !existsSync(r.abs)) err(ledgerAbs, row.line, `destination ${target} does not exist`);
            else if (r.anchor && r.abs.endsWith(".md") && !parse(r.abs).anchors.has(r.anchor)) {
              err(ledgerAbs, row.line, `destination ${target}: no heading with anchor #${r.anchor} in ${rel(r.abs)}`);
            }
          }
        }
        const conflict = cleanCell(row.cells[3] ?? "");
        if (conflict && !DASH.test(conflict) && !/\brule\s*\(?[a-d]\b/i.test(conflict)) {
          err(ledgerAbs, row.line, `conflict cell must be "—" or cite precedence "rule a|b|c|d"`);
        }
      }
    }
  }

  return errors;
}

// ---------- CLI ----------

function pluginCacheHint() {
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (root && SCRIPT_DIR.startsWith(root)) {
    console.error(
      `note: running from the plugin cache. For CI, vendor the skill into the project:\n` +
        `  npx skills add basselalsayed/skills --skill ${SKILL_NAME} -a claude-code`,
    );
  }
}

// Self-test: fixtures/good must pass; each case in fixtures/negative.mjs mutates a
// copy of it and must produce an error matching `match`.
async function selfTest() {
  const fixtures = join(SCRIPT_DIR, "fixtures");
  const good = join(fixtures, "good");
  let failed = 0;
  const goodErrors = checkDocs(good);
  if (goodErrors.length) {
    failed++;
    console.log(`FAIL good tree: expected pass, got:\n  ${goodErrors.join("\n  ")}`);
  } else {
    console.log("ok   good tree (pass)");
  }
  const { cases, mutator } = await import(pathToFileURL(join(fixtures, "negative.mjs")).href);
  for (const tc of cases) {
    const dir = mkdtempSync(join(tmpdir(), "check-docs-"));
    let verdict;
    try {
      cpSync(good, dir, { recursive: true });
      tc.apply(mutator(dir));
      const errs = checkDocs(dir);
      verdict = errs.some((e) => tc.match.test(e))
        ? null
        : `expected an error matching ${tc.match}, got: ${errs.length ? errs.join(" | ") : "no errors"}`;
    } catch (e) {
      verdict = `threw: ${e.message}`;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    if (verdict) {
      failed++;
      console.log(`FAIL ${tc.name}: ${verdict}`);
    } else {
      console.log(`ok   ${tc.name} (fail)`);
    }
  }
  const total = cases.length + 1;
  console.log(`\n${total - failed}/${total} fixture cases passed`);
  return failed === 0;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) process.exit((await selfTest()) ? 0 : 1);
  pluginCacheHint();
  if (args.length > 1 || args.some((a) => a.startsWith("-"))) {
    console.error("usage: check-docs.mjs [<root>] | --self-test");
    process.exit(2);
  }
  const errors = checkDocs(args[0] ?? process.cwd());
  for (const e of errors) console.error(e);
  if (errors.length) {
    console.error(`\ncheck-docs: ${errors.length} problem(s)`);
    process.exit(1);
  }
  console.log("check-docs: ok");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) await main();
