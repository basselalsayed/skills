// Commits authored by renovate[bot] are exempt; other bots are not.
const RENOVATE = { name: "renovate[bot]", email: "29139614+renovate[bot]@users.noreply.github.com" };
const OTHER = { name: "other[bot]", email: "1+other[bot]@users.noreply.github.com" };

export const cases = [
  {
    name: "renovate[bot] commit without entry passes",
    expect: "pass",
    build(repo) {
      const base = repo.activate();
      repo.change("chore(deps): update rust crate tokio to v1.48", { entry: false, author: RENOVATE });
      return `${base}..HEAD`;
    },
  },
  {
    name: "other bot commit without entry fails",
    expect: "fail",
    match: /chore: bump: no entry/,
    build(repo) {
      const base = repo.activate();
      repo.change("chore: bump", { entry: false, author: OTHER });
      return `${base}..HEAD`;
    },
  },
];
