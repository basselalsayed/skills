import { NEXT_DATE, NEXT_DAY } from "./_repo.mjs";

// Merge commits are exempt; the merged commits are still checked.
export const cases = [
  {
    name: "merge commit without entry passes",
    expect: "pass",
    build(repo) {
      const base = repo.activate();
      repo.git("checkout", "-q", "-b", "topic");
      repo.change("feat: on topic", { file: "topic.txt", day: NEXT_DAY, date: NEXT_DATE });
      repo.git("checkout", "-q", "main");
      repo.change("feat: on main", { file: "main.txt" });
      repo.git("-c", "user.name=Dev", "-c", "user.email=dev@example.com", "merge", "-q", "--no-ff", "--no-edit", "topic");
      return `${base}..HEAD`;
    },
  },
  {
    name: "merged commit without entry still fails",
    expect: "fail",
    match: /feat: unlogged on topic: no entry/,
    build(repo) {
      const base = repo.activate();
      repo.git("checkout", "-q", "-b", "topic");
      repo.change("feat: unlogged on topic", { file: "topic.txt", entry: false });
      repo.git("checkout", "-q", "main");
      repo.git("-c", "user.name=Dev", "-c", "user.email=dev@example.com", "merge", "-q", "--no-ff", "--no-edit", "topic");
      return `${base}..HEAD`;
    },
  },
];
