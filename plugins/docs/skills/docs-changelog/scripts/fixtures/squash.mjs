// GitHub squash-merges on main are exempt; the same subject from a developer is not.
const GITHUB = { name: "GitHub", email: "noreply@github.com" };
const DEV = { name: "Dev", email: "dev@example.com" };

export const cases = [
  {
    name: "GitHub squash-merge without entry passes",
    expect: "pass",
    build(repo) {
      const base = repo.activate();
      repo.change("feat: squashed work (#12)", { entry: false, author: DEV, committer: GITHUB });
      return `${base}..HEAD`;
    },
  },
  {
    name: "developer commit with a (#N) subject still needs an entry",
    expect: "fail",
    match: /feat: looks squashed \(#13\): no entry/,
    build(repo) {
      const base = repo.activate();
      repo.change("feat: looks squashed (#13)", { entry: false });
      return `${base}..HEAD`;
    },
  },
];
