# F-001: Repo and CI
- Status: built · Phase: 0 · Plan tasks: T0.1 · Depends on: —
- Evidence: CI job `rust`, commit abc1234
- Decisions: [ADR-0001](../adr/0001-use-ci-gate.md) · Design: [backend](../design/backend.md#outbox-claim--ack-v2) · Deferred: [flaky CI](../todos/flaky-ci.md)

## Current behaviour

#### Requirement: Format gate
CI SHALL fail when `cargo fmt --check` fails.

##### Scenario: unformatted file
WHEN a pushed file is unformatted THEN the `rust` job fails.

## Proposed changes

## Open questions

- [Flaky CI runners](../todos/flaky-ci.md)
