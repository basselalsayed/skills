// A revert's entry must say what it reverts (SHA prefix or reverted subject).
function revertMessage(sha, subject, style) {
  return style === "git" ? `Revert "${subject}"\n\nThis reverts commit ${sha}.` : `revert: ${subject}\n\nThis reverts commit ${sha}.`;
}

export const cases = [
  {
    name: 'git-style Revert "..." naming the SHA passes',
    expect: "pass",
    build(repo) {
      const base = repo.activate();
      const sha = repo.change("feat: risky");
      repo.append("src.txt", "undo\n");
      repo.entry('Revert "feat: risky"', `Reverts ${sha.slice(0, 7)}; it broke the build.`);
      repo.commit(revertMessage(sha, "feat: risky", "git"));
      return `${base}..HEAD`;
    },
  },
  {
    name: "revert: naming the reverted subject passes",
    expect: "pass",
    build(repo) {
      const base = repo.activate();
      const sha = repo.change("feat: risky");
      repo.append("src.txt", "undo\n");
      repo.entry("revert: feat: risky", "Backs out feat: risky until F-104 is ready.");
      repo.commit(revertMessage(sha, "feat: risky", "conventional"));
      return `${base}..HEAD`;
    },
  },
  {
    name: "revert entry that does not say what it reverts fails",
    expect: "fail",
    match: /does not say what it reverts/,
    build(repo) {
      const base = repo.activate();
      const sha = repo.change("feat: risky");
      repo.append("src.txt", "undo\n");
      repo.entry('Revert "feat: risky"', "Undo.");
      repo.commit(revertMessage(sha, "feat: risky", "git"));
      return `${base}..HEAD`;
    },
  },
];
