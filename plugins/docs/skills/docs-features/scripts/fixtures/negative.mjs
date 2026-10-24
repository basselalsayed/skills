// Negative cases for check-docs.mjs --self-test. Each case mutates a copy of
// fixtures/good and expects at least one error matching `match`.

import { appendFileSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function mutator(root) {
  const p = (path) => join(root, path);
  return {
    write: (path, text) => writeFileSync(p(path), text),
    append: (path, text) => appendFileSync(p(path), text),
    rm: (path) => rmSync(p(path)),
    replace(path, from, to) {
      const text = readFileSync(p(path), "utf8");
      if (!text.includes(from)) throw new Error(`fixture drift: "${from}" not in ${path}`);
      writeFileSync(p(path), text.replace(from, to));
    },
  };
}

const REG = "docs/features/README.md";
const LEDGER = "docs/migration/ralplan-v20-ledger.md";

export const cases = [
  {
    name: "registry row whose feature file is deleted",
    match: /^docs\/features\/README\.md:\d+: broken link: widget\.md/,
    apply: (m) => m.rm("docs/features/widget.md"),
  },
  {
    name: "registry status differs from the feature doc",
    match: /F-002: registry status "planned" != "in-progress"/,
    apply: (m) => m.replace("docs/features/widget.md", "Status: planned", "Status: in-progress"),
  },
  {
    name: "status outside the vocabulary",
    match: /F-201: status "done" not in/,
    apply: (m) => m.replace(REG, "| F-201 | Organising | planned |", "| F-201 | Organising | done |"),
  },
  {
    name: "built feature without Evidence",
    match: /F-001 is built but has no Evidence/,
    apply: (m) => m.replace("docs/features/repo-ci.md", "- Evidence: CI job `rust`, commit abc1234", "- Evidence:"),
  },
  {
    name: "duplicate feature ID in two docs",
    match: /duplicate feature ID F-002/,
    apply: (m) => m.replace("docs/features/organising.md", "# F-201: Organising", "# F-002: Organising"),
  },
  {
    name: "duplicate registry ID",
    match: /duplicate registry ID F-001/,
    apply: (m) => m.replace(REG, "| F-201 | Organising |", "| F-001 | Organising |"),
  },
  {
    name: "feature doc without a registry row",
    match: /docs\/features\/stray\.md:1: F-009 has no row/,
    apply: (m) =>
      m.write(
        "docs/features/stray.md",
        "# F-009: Stray\n- Status: planned · Phase: 1\n\n#### Requirement: X\nIt SHALL x.\n\n##### Scenario: y\nWHEN a THEN b.\n",
      ),
  },
  {
    name: "row ID differs from the linked doc heading",
    match: /F-201: Docs links docs\/features\/widget\.md but F-201 is docs\/features\/organising\.md/,
    apply: (m) => m.replace(REG, "[spec](organising.md)", "[spec](widget.md)"),
  },
  {
    name: "row without Depends on",
    match: /F-201: empty Depends on/,
    apply: (m) => m.replace(REG, "| F-002 | [spec](organising.md)", "|  | [spec](organising.md)"),
  },
  {
    name: "T-ID in two rows",
    match: /T0\.1 is in the Plan tasks of F-001 and F-002/,
    apply: (m) => m.replace(REG, "T0.2, T0.3", "T0.2, T0.3, T0.1"),
  },
  {
    name: "Requirement without Scenario in a Phase 0 doc",
    match: /widget\.md:\d+: "Requirement: Widget hides" has no "##### Scenario:"/,
    apply: (m) => m.replace("docs/features/widget.md", "##### Scenario: dismiss\n", ""),
  },
  {
    name: "Requirement without Scenario in a design doc",
    match: /design\/backend\.md:\d+: "Requirement: Untested" has no/,
    apply: (m) => m.append("docs/design/backend.md", "\n#### Requirement: Untested\nIt SHALL x.\n"),
  },
  {
    name: "feature doc with no Requirement",
    match: /F-201 has no "#### Requirement:"/,
    apply: (m) => m.replace("docs/features/organising.md", "#### Requirement: Organise", "Organise"),
  },
  {
    name: "link to a missing heading anchor",
    match: /repo-ci\.md:\d+: broken link: \.\.\/design\/backend\.md#outbox-claim-ack-v2 \(no heading/,
    apply: (m) => m.replace("docs/features/repo-ci.md", "backend.md#outbox-claim--ack-v2", "backend.md#outbox-claim-ack-v2"),
  },
  {
    name: "same-file anchor to a missing heading",
    match: /design\/backend\.md:\d+: broken link: #plain-section-2/,
    apply: (m) => m.replace("docs/design/backend.md", "(#plain-section-1)", "(#plain-section-2)"),
  },
  {
    name: "ADR not in the index",
    match: /docs\/adr\/0003-orphan\.md:1: not listed in docs\/adr\/README\.md/,
    apply: (m) =>
      m.write(
        "docs/adr/0003-orphan.md",
        "---\nstatus: proposed\ndate: 24-10-2026\ndecision-makers: Bassel\n---\n# ADR-0003: Orphan\n\n## Context and Problem Statement\n\n## Considered Options\n\n## Decision Outcome\n\n### Consequences\n\n## More Information\n",
      ),
  },
  {
    name: "accepted ADR without Confirmation",
    match: /0001-use-ci-gate\.md:1: accepted ADR needs "### Confirmation"/,
    apply: (m) => m.replace("docs/adr/0001-use-ci-gate.md", "### Confirmation", "### Checks"),
  },
  {
    name: "ADR frontmatter without decision-makers",
    match: /0002-pick-a-queue\.md:1: frontmatter has no "decision-makers"/,
    apply: (m) => m.replace("docs/adr/0002-pick-a-queue.md", "decision-makers: Bassel\n", ""),
  },
  {
    name: "ADR date not DD-MM-YYYY",
    match: /date "2026-10-20" is not DD-MM-YYYY/,
    apply: (m) => m.replace("docs/adr/0002-pick-a-queue.md", "date: 20-10-2026", "date: 2026-10-20"),
  },
  {
    name: "ADR missing a MADR heading",
    match: /0002-pick-a-queue\.md:1: missing heading "## Considered Options"/,
    apply: (m) => m.replace("docs/adr/0002-pick-a-queue.md", "## Considered Options", "## Options"),
  },
  {
    name: "ADR title number differs from the file name",
    match: /title must be "# ADR-0002: \.\.\."/,
    apply: (m) => m.replace("docs/adr/0002-pick-a-queue.md", "# ADR-0002:", "# ADR-0020:"),
  },
  {
    name: "ADR index status differs from frontmatter",
    match: /docs\/adr\/README\.md:\d+: status "accepted" != "proposed"/,
    apply: (m) => m.replace("docs/adr/0001-use-ci-gate.md", "status: accepted", "status: proposed"),
  },
  {
    name: ".omc/ reference in AGENTS.md",
    match: /^AGENTS\.md:\d+: forbidden reference "\.omc\/"/,
    apply: (m) => m.append("AGENTS.md", "See .omc/plans/x.md.\n"),
  },
  {
    name: "archive/ralplan reference under docs/",
    match: /docs\/changelog\/24-10-2026\.md:\d+: forbidden reference "archive\/ralplan"/,
    apply: (m) => m.append("docs/changelog/24-10-2026.md", "Frozen on archive/ralplan-v20.\n"),
  },
  {
    name: "todo linked only from the todos index",
    match: /docs\/todos\/orphan\.md:1: todo is not linked/,
    apply: (m) => {
      m.write("docs/todos/orphan.md", "# Orphan\n- Created: 24-10-2026 · Origin: F-001\n- Why deferred: x\n## What to do\n");
      m.append("docs/todos/README.md", "- [orphan](orphan.md)\n");
    },
  },
  {
    name: "ledger row with an empty cell",
    match: /ralplan-v20-ledger\.md:\d+: empty "Unit" cell/,
    apply: (m) => m.replace(LEDGER, "| v12 review notes |", "|  |"),
  },
  {
    name: "ledger destination with a missing anchor",
    match: /ralplan-v20-ledger\.md:\d+: destination docs\/design\/backend\.md#no-such-heading: no heading/,
    apply: (m) => m.replace(LEDGER, "docs/design/backend.md#outbox-claim--ack-v2", "docs/design/backend.md#no-such-heading"),
  },
  {
    name: "ledger destination file missing",
    match: /destination docs\/design\/gone\.md does not exist/,
    apply: (m) => m.replace(LEDGER, "docs/adr/0002-pick-a-queue.md |", "docs/design/gone.md |"),
  },
  {
    name: "ledger todo disposition without a todo file",
    match: /todo "missing-slug" has no docs\/todos\/missing-slug\.md/,
    apply: (m) => m.replace(LEDGER, "todo: flaky-ci", "todo: missing-slug"),
  },
  {
    name: "ledger malformed dropped disposition",
    match: /disposition must be "dropped: superseded by <where>"/,
    apply: (m) => m.replace(LEDGER, "dropped: review history", "dropped: no longer needed"),
  },
  {
    name: "ledger conflict without a precedence rule",
    match: /conflict cell must be "—" or cite precedence/,
    apply: (m) => m.replace(LEDGER, "rule b: ADR-0001 vs §10 ADR-0002", "ADR-0001 wins"),
  },
  {
    name: "ledger destination that is neither path nor disposition",
    match: /destination "see design" is neither/,
    apply: (m) => m.replace(LEDGER, "| docs/adr/0002-pick-a-queue.md |", "| see design |"),
  },
];
