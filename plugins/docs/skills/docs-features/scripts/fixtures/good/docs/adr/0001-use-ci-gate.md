---
status: accepted
date: 23-10-2026
decision-makers: Bassel
---
# ADR-0001: Use a CI gate

## Context and Problem Statement

Unformatted code lands.

## Considered Options

- CI gate
- Review only

## Decision Outcome

Chosen option: "CI gate", because it is automatic.

### Consequences

- Good: consistent formatting.

### Confirmation

The `rust` CI job runs `cargo fmt --check`.

## More Information

F-001, T0.1.
