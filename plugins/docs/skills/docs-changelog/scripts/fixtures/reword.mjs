// After a reword/amend the commit is checked as amended.
import { DAY, NEXT_DATE, NEXT_DAY } from "./_repo.mjs";

export const cases = [
  {
    name: "reworded subject with updated entry passes",
    expect: "pass",
    build(repo) {
      const base = repo.activate();
      repo.change("feat: old name");
      repo.write(`docs/changelog/${DAY}.md`, `\n## docs: add changelog\nTouches F-001.\n\n## feat: new name\nTouches F-001.\n`);
      repo.commit("feat: new name", { amend: true });
      return `${base}..HEAD`;
    },
  },
  {
    name: "reworded subject with stale entry fails",
    expect: "fail",
    match: /no "## feat: new name" heading/,
    build(repo) {
      const base = repo.activate();
      repo.change("feat: old name");
      repo.commit("feat: new name", { amend: true });
      return `${base}..HEAD`;
    },
  },
  {
    name: "redated commit with entry left in the old day-file fails",
    expect: "fail",
    match: /author date 24-10-2026/,
    build(repo) {
      const base = repo.activate();
      repo.change("feat: moved");
      repo.commit("feat: moved", { amend: true, date: NEXT_DATE });
      return `${base}..HEAD`;
    },
  },
  {
    name: "redated commit with entry moved to the new day-file passes",
    expect: "pass",
    build(repo) {
      const base = repo.activate();
      repo.change("feat: moved");
      repo.write(`docs/changelog/${DAY}.md`, `\n## docs: add changelog\nTouches F-001.\n`);
      repo.entry("feat: moved", "Touches F-001.", NEXT_DAY);
      repo.commit("feat: moved", { amend: true, date: NEXT_DATE });
      return `${base}..HEAD`;
    },
  },
];
