// Builds throwaway git repos for check-changelog.mjs --self-test.
// Each fixture file exports `cases`: { name, expect, match?, build(repo) => "<base>..<head>" }.

import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const DAY = "23-10-2026";
export const DATE = "2026-10-23T12:00:00+02:00";
export const NEXT_DAY = "24-10-2026";
export const NEXT_DATE = "2026-10-24T09:00:00+02:00";

const DEV = { name: "Dev", email: "dev@example.com" };

export function makeRepo(dir) {
  const baseEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
  const run = (args, env = {}) =>
    execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...baseEnv, ...env },
    }).trim();

  run(["init", "-q", "-b", "main"]);

  const repo = {
    dir,
    git: (...args) => run(args),
    head: () => run(["rev-parse", "HEAD"]),
    write(path, content) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), content);
    },
    append(path, content) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      appendFileSync(join(dir, path), content);
    },
    rm(path) {
      rmSync(join(dir, path));
    },
    // Changelog entry text for `subject` in the day-file `day`.
    entry(subject, body = "Touches F-001.", day = DAY) {
      repo.append(`docs/changelog/${day}.md`, `\n## ${subject}\n${body}\n`);
    },
    // Stage everything and commit. Returns the new SHA.
    commit(message, { date = DATE, author = DEV, committer = author, amend = false } = {}) {
      run(["add", "-A"]);
      run(["commit", "-q", "--allow-empty", ...(amend ? ["--amend"] : []), `--date=${date}`, "-m", message], {
        GIT_AUTHOR_NAME: author.name,
        GIT_AUTHOR_EMAIL: author.email,
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_NAME: committer.name,
        GIT_COMMITTER_EMAIL: committer.email,
        GIT_COMMITTER_DATE: date,
      });
      return repo.head();
    },
    // A code change plus its entry, committed.
    change(subject, { body, day = DAY, date = DATE, file = "src.txt", entry = true, ...opts } = {}) {
      repo.append(file, `${subject}\n`);
      if (entry) repo.entry(subject, body, day);
      return repo.commit(subject, { date, ...opts });
    },
    // Pre-boundary history, then the activation commit adding docs/changelog/README.md.
    // Returns the SHA of the last pre-boundary commit (a valid range base).
    activate({ sha = false } = {}) {
      repo.append("README.md", "# project\n");
      repo.commit("chore: initial commit");
      const before = repo.head();
      repo.write("docs/changelog/README.md", "# Changelog\n\nActivation boundary: PENDING\n");
      repo.entry("docs: add changelog");
      const boundary = repo.commit("docs: add changelog");
      if (sha) {
        repo.write("docs/changelog/README.md", `# Changelog\n\nActivation boundary: ${boundary}\n`);
        repo.entry("docs: record activation boundary", "Records the boundary SHA.");
        repo.commit("docs: record activation boundary");
      }
      return before;
    },
  };
  return repo;
}
