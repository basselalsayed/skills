---
status: superseded by ADR-0001
date: 20-10-2026
decision-makers: Bassel
---
# ADR-0002: Pick a queue

## Context and Problem Statement

Work needs a queue.

## Considered Options

- Postgres outbox

## Decision Outcome

Chosen option: "Postgres outbox", because it is transactional.

### Consequences

- Good: one database.

## More Information

Superseded by [ADR-0001](0001-use-ci-gate.md).
