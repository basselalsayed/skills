// Ordinary development commits: entry present, missing, wrong day, no body, wrong heading.
import { DAY, NEXT_DATE, NEXT_DAY } from "./_repo.mjs";

export const cases = [
  {
    name: "commits with entries pass",
    expect: "pass",
    build(repo) {
      const base = repo.activate();
      repo.change("feat(api): add health route");
      repo.change("fix(api): handle timeout", { day: NEXT_DAY, date: NEXT_DATE });
      return `${base}..HEAD`;
    },
  },
  {
    name: "commit touching only README.md fails",
    expect: "fail",
    match: /no entry: docs\/changelog\/23-10-2026\.md not changed/,
    build(repo) {
      const base = repo.activate();
      repo.append("README.md", "more\n");
      repo.commit("docs: tweak readme");
      return `${base}..HEAD`;
    },
  },
  {
    name: "entry in the wrong day-file fails",
    expect: "fail",
    match: /not changed \(author date 24-10-2026\)/,
    build(repo) {
      const base = repo.activate();
      repo.change("feat: late night", { day: DAY, date: NEXT_DATE });
      return `${base}..HEAD`;
    },
  },
  {
    name: "heading without a body line fails",
    expect: "fail",
    match: /has no body line/,
    build(repo) {
      const base = repo.activate();
      repo.append("src.txt", "x\n");
      repo.append(`docs/changelog/${DAY}.md`, "\n## feat: bare heading\n\n");
      repo.commit("feat: bare heading");
      return `${base}..HEAD`;
    },
  },
  {
    name: "heading that differs from the subject fails",
    expect: "fail",
    match: /no "## feat: real subject" heading/,
    build(repo) {
      const base = repo.activate();
      repo.append("src.txt", "x\n");
      repo.entry("feat: other subject");
      repo.commit("feat: real subject");
      return `${base}..HEAD`;
    },
  },
  {
    name: "entry added by an earlier commit does not count",
    expect: "fail",
    match: /feat: second: no entry/,
    build(repo) {
      const base = repo.activate();
      repo.append("src.txt", "x\n");
      repo.entry("feat: second");
      repo.entry("feat: first");
      repo.commit("feat: first");
      repo.append("src.txt", "y\n");
      repo.commit("feat: second");
      return `${base}..HEAD`;
    },
  },
  {
    name: "empty range passes",
    expect: "pass",
    build(repo) {
      repo.activate();
      return "HEAD..HEAD";
    },
  },
  {
    name: "all-zero base (new branch push) passes",
    expect: "pass",
    build(repo) {
      repo.activate();
      repo.append("src.txt", "no entry\n");
      repo.commit("feat: no entry");
      return `${"0".repeat(40)}..HEAD`;
    },
  },
];
