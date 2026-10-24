#!/usr/bin/env node
// Checks that every in-scope commit in a range adds its own changelog entry.
//
// Usage:  node check-changelog.mjs <base>..<head>
//         node check-changelog.mjs --self-test
//
// Entry rule (docs/changelog/README.md): each in-scope commit adds, as `+`
// lines in its own diff, a `## <subject>` heading in
// docs/changelog/<DD-MM-YYYY>.md (named by its author date) followed by at
// least one body line. `fixup!`/`squash!` prefixes are stripped before the
// subject is compared. A revert's entry names the reverted commit (SHA prefix
// or subject).
//
// Exempt: merge commits, GitHub squash-merges (committer noreply@github.com,
// subject ending `(#N)`), commits authored by renovate[bot], and commits
// before the activation boundary. The boundary is the `Activation boundary:
// <sha>` line in docs/changelog/README.md when that SHA resolves; otherwise a
// commit is pre-boundary when its tree has no docs/changelog/README.md.
//
// A zero base (`0000…0000..<head>`, a new branch push) and an empty range pass.
// Exit 0 when every commit passes, 1 on any failure, 2 on usage errors.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CHANGELOG_DIR = "docs/changelog";
const README = `${CHANGELOG_DIR}/README.md`;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_NAME = basename(dirname(SCRIPT_DIR));

function git(cwd, args, { allowFail = false } = {}) {
  try {
    return execFileSync("git", ["-c", "log.showSignature=false", "-c", "core.quotepath=off", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    if (allowFail) return null;
    throw new Error(`git ${args.join(" ")}: ${(err.stderr || err.message).trim()}`);
  }
}

function stripPrefixes(subject) {
  let s = subject.trim();
  for (;;) {
    const m = s.match(/^(?:fixup|squash|amend)!\s*(.*)$/);
    if (!m) return s;
    s = m[1].trim();
  }
}

function listCommits(cwd, range) {
  // %x1f between fields, %x1e between commits; %B last because it may hold anything.
  const fmt = ["%H", "%P", "%an", "%ae", "%ce", "%ad", "%s", "%B"].join("%x1f") + "%x1e";
  const out = git(cwd, ["log", "--reverse", "--date=format:%d-%m-%Y", `--format=${fmt}`, range]);
  return out
    .split("\x1e")
    .map((rec) => rec.replace(/^\n/, ""))
    .filter((rec) => rec.length > 0)
    .map((rec) => {
      const [sha, parents, authorName, authorEmail, committerEmail, date, subject, body] = rec.split("\x1f");
      return {
        sha,
        parents: parents.split(" ").filter(Boolean),
        authorName,
        authorEmail,
        committerEmail,
        date,
        subject,
        body,
      };
    });
}

function boundaryOf(cwd, head) {
  const readme = git(cwd, ["show", `${head}:${README}`], { allowFail: true });
  const m = readme?.match(/^\s*Activation boundary:\s*`?([0-9a-f]{7,40})\b/im);
  if (!m) return null;
  const sha = git(cwd, ["rev-parse", "--verify", "--quiet", `${m[1]}^{commit}`], { allowFail: true });
  if (!sha) {
    console.error(`warning: activation boundary ${m[1]} in ${README} does not resolve; using README presence`);
    return null;
  }
  return sha.trim();
}

function exemption(c, cwd, boundary) {
  if (c.parents.length > 1) return "merge commit";
  if (c.committerEmail === "noreply@github.com" && /\(#\d+\)\s*$/.test(c.subject)) return "GitHub squash-merge";
  if (c.authorName === "renovate[bot]" || /^(\d+\+)?renovate\[bot\]@/.test(c.authorEmail)) return "renovate[bot]";
  if (boundary) {
    const after = git(cwd, ["merge-base", "--is-ancestor", boundary, c.sha], { allowFail: true }) !== null;
    if (!after) return "before activation boundary";
  } else if (git(cwd, ["cat-file", "-e", `${c.sha}:${README}`], { allowFail: true }) === null) {
    return "before activation boundary";
  }
  return null;
}

function addedLines(cwd, c, path) {
  const args = ["show", "--format=", "--unified=0", "--no-color", "--no-ext-diff"];
  if (c.parents.length === 0) args.push("--root");
  const out = git(cwd, [...args, c.sha, "--", path]);
  return out
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1));
}

function revertTarget(c) {
  const sha = c.body.match(/This reverts commit ([0-9a-f]{7,40})/)?.[1] ?? null;
  const subject =
    c.subject.match(/^Revert\s+"(.*)"\s*$/)?.[1] ?? c.subject.match(/^revert(?:\([^)]*\))?!?:\s*(.*)$/i)?.[1] ?? null;
  return sha || subject ? { sha, subject } : null;
}

function checkCommit(cwd, c) {
  const file = `${CHANGELOG_DIR}/${c.date}.md`;
  const subject = stripPrefixes(c.subject);
  const added = addedLines(cwd, c, file);
  if (added.length === 0) return `no entry: ${file} not changed (author date ${c.date})`;
  const at = added.findIndex((l) => /^##\s/.test(l) && l.replace(/^##\s+/, "").trim() === subject);
  if (at === -1) return `no "## ${subject}" heading added to ${file}`;
  const body = [];
  for (const l of added.slice(at + 1)) {
    if (/^#{1,6}\s/.test(l)) break;
    if (l.trim()) body.push(l.trim());
  }
  if (body.length === 0) return `entry "## ${subject}" in ${file} has no body line`;
  const target = revertTarget({ ...c, subject });
  if (target) {
    const text = body.join("\n");
    const namesSha = target.sha && (text.match(/\b[0-9a-f]{7,40}\b/g) ?? []).some((h) => target.sha.startsWith(h));
    const namesSubject = target.subject && text.includes(target.subject);
    if (!namesSha && !namesSubject) return `revert entry in ${file} does not say what it reverts (SHA or subject)`;
  }
  return null;
}

export function checkRange(range, { cwd = process.cwd(), log = console.log } = {}) {
  const i = range?.indexOf("..") ?? -1;
  if (i === -1 || range[i + 2] === "." || i + 2 === range.length) {
    throw new UsageError(`expected <base>..<head>, got "${range ?? ""}"`);
  }
  const base = range.slice(0, i);
  const head = range.slice(i + 2);
  if (/^0+$/.test(base)) {
    log(`check-changelog: base is all zeros, nothing to compare; skipped`);
    return [];
  }
  for (const rev of [base, head].filter(Boolean)) {
    if (!git(cwd, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`], { allowFail: true })) {
      throw new UsageError(`unknown revision "${rev}"`);
    }
  }
  const commits = listCommits(cwd, range);
  if (commits.length === 0) {
    log(`check-changelog: ${range} is empty; nothing to check`);
    return [];
  }
  const boundary = boundaryOf(cwd, head || "HEAD");
  const errors = [];
  for (const c of commits) {
    const short = c.sha.slice(0, 12);
    const why = exemption(c, cwd, boundary);
    if (why) {
      log(`skip ${short} ${c.subject} (${why})`);
      continue;
    }
    const err = checkCommit(cwd, c);
    if (err) errors.push(`${short} ${c.subject}: ${err}`);
    else log(`ok   ${short} ${c.subject}`);
  }
  return errors;
}

class UsageError extends Error {}

function pluginCacheHint() {
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (root && SCRIPT_DIR.startsWith(root)) {
    console.error(
      `note: running from the plugin cache. For CI, vendor the skill into the project:\n` +
        `  npx skills add basselalsayed/skills --skill ${SKILL_NAME} -a claude-code`,
    );
  }
}

// Self-test: each fixtures/*.mjs exports `cases`, a list of
// { name, expect: "pass" | "fail", match?, build(repo) => range }.
async function selfTest() {
  const fixturesDir = join(SCRIPT_DIR, "fixtures");
  const { makeRepo } = await import(pathToFileURL(join(fixturesDir, "_repo.mjs")).href);
  let failed = 0;
  let total = 0;
  for (const file of readdirSync(fixturesDir).filter((f) => f.endsWith(".mjs") && !f.startsWith("_")).sort()) {
    const { cases } = await import(pathToFileURL(join(fixturesDir, file)).href);
    for (const tc of cases) {
      total++;
      const dir = mkdtempSync(join(tmpdir(), "check-changelog-"));
      let verdict;
      try {
        const repo = makeRepo(dir);
        const range = tc.build(repo);
        const errors = checkRange(range, { cwd: dir, log: () => {} });
        const got = errors.length === 0 ? "pass" : "fail";
        const matched = !tc.match || errors.some((e) => tc.match.test(e));
        verdict = got === tc.expect && matched ? null : `expected ${tc.expect}${tc.match ? ` ${tc.match}` : ""}, got ${got}: ${errors.join("; ") || "no errors"}`;
      } catch (err) {
        verdict = `threw: ${err.message}`;
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
      const label = `${file.replace(/\.mjs$/, "")}: ${tc.name}`;
      if (verdict) {
        failed++;
        console.log(`FAIL ${label}: ${verdict}`);
      } else {
        console.log(`ok   ${label} (${tc.expect})`);
      }
    }
  }
  console.log(`\n${total - failed}/${total} fixture cases passed`);
  return failed === 0;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) process.exit((await selfTest()) ? 0 : 1);
  pluginCacheHint();
  if (args.length !== 1) {
    console.error("usage: check-changelog.mjs <base>..<head> | --self-test");
    process.exit(2);
  }
  let errors;
  try {
    errors = checkRange(args[0]);
  } catch (err) {
    console.error(`check-changelog: ${err.message}`);
    process.exit(err instanceof UsageError ? 2 : 1);
  }
  if (errors.length > 0) {
    console.error(`\n${errors.length} commit(s) without a valid changelog entry:`);
    for (const e of errors) console.error(`  ${e}`);
    console.error(`\nSee ${README} for the entry rule.`);
    process.exit(1);
  }
  console.log("check-changelog: all in-scope commits have entries");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) await main();
