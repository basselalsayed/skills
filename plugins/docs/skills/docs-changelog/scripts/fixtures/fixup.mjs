// fixup!/squash! prefixes are stripped before the heading is compared.
export const cases = [
  {
    name: "fixup! commit with the stripped heading passes",
    expect: "pass",
    build(repo) {
      const base = repo.activate();
      repo.change("feat: widget");
      repo.append("src.txt", "fix\n");
      repo.entry("feat: widget", "Fixes the widget follow-up.");
      repo.commit("fixup! feat: widget");
      return `${base}..HEAD`;
    },
  },
  {
    name: "squash! fixup! chain with the stripped heading passes",
    expect: "pass",
    build(repo) {
      const base = repo.activate();
      repo.change("feat: gadget");
      repo.append("src.txt", "fix\n");
      repo.entry("feat: gadget", "Squashes into the gadget.");
      repo.commit("squash! fixup! feat: gadget");
      return `${base}..HEAD`;
    },
  },
  {
    name: "fixup! commit with a prefixed heading fails",
    expect: "fail",
    match: /no "## feat: widget" heading/,
    build(repo) {
      const base = repo.activate();
      repo.change("feat: widget");
      repo.append("src.txt", "fix\n");
      repo.entry("fixup! feat: widget");
      repo.commit("fixup! feat: widget");
      return `${base}..HEAD`;
    },
  },
  {
    name: "fixup! commit without any entry fails",
    expect: "fail",
    match: /fixup! feat: widget: no entry/,
    build(repo) {
      const base = repo.activate();
      repo.change("feat: widget");
      repo.append("src.txt", "fix\n");
      repo.commit("fixup! feat: widget");
      return `${base}..HEAD`;
    },
  },
];
