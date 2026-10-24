// Commits before the activation boundary are never checked.
export const cases = [
  {
    name: "range starting before docs/changelog/README.md exists passes",
    expect: "pass",
    build(repo) {
      repo.append("a.txt", "1\n");
      const root = repo.commit("chore: root");
      repo.append("a.txt", "2\n");
      repo.commit("feat: old work without entry");
      repo.activate();
      repo.change("feat: new work");
      return `${root}..HEAD`;
    },
  },
  {
    name: "commit after the boundary without entry fails",
    expect: "fail",
    match: /feat: new work: no entry/,
    build(repo) {
      repo.append("a.txt", "1\n");
      const root = repo.commit("chore: root");
      repo.activate();
      repo.change("feat: new work", { entry: false });
      return `${root}..HEAD`;
    },
  },
  {
    name: "recorded boundary SHA exempts commits not descending from it",
    expect: "pass",
    build(repo) {
      // A side branch from before the boundary that gained the README later is still pre-boundary.
      repo.append("a.txt", "1\n");
      const root = repo.commit("chore: root");
      repo.activate({ sha: true });
      repo.git("checkout", "-q", "-b", "old", root);
      repo.write("docs/changelog/README.md", "# Changelog\n");
      repo.commit("docs: early readme without entry");
      repo.git("checkout", "-q", "main");
      repo.git("-c", "user.name=Dev", "-c", "user.email=dev@example.com", "merge", "-q", "--no-ff", "--no-edit", "-s", "ours", "old");
      repo.change("feat: after boundary");
      return `${root}..HEAD`;
    },
  },
  {
    name: "unresolvable boundary SHA falls back to README presence",
    expect: "fail",
    match: /feat: unlogged: no entry/,
    build(repo) {
      const base = repo.activate();
      repo.write("docs/changelog/README.md", "# Changelog\n\nActivation boundary: deadbeefdeadbeef\n");
      repo.entry("docs: bad boundary");
      repo.commit("docs: bad boundary");
      repo.change("feat: unlogged", { entry: false });
      return `${base}..HEAD`;
    },
  },
];
