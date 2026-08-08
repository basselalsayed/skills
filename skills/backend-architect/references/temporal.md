# Temporal durable-execution guide

Use Temporal for durable timers, signals, cancellation, multi-step state,
fan-out, and recovery across process failure. Keep short independent jobs in a
simpler runner when they do not need those semantics. Temporal owns durable
sequencing; application use cases still own business decisions and state.

Verify fast-moving APIs against the current official Temporal Python SDK docs.
For implementation shapes, also read
[Python patterns](temporal/python-patterns.md).

## Contents

- [Boundary and ownership](#boundary-and-ownership)
- [Determinism and durable contracts](#determinism-and-durable-contracts)
- [Activities and worker DI](#activities-and-worker-di)
- [Durable start and outbox dispatch](#durable-start-and-outbox-dispatch)
- [Retries, cancellation, and history](#retries-cancellation-and-history)
- [Testing and deployment](#testing-and-deployment)
- [Review checklist](#review-checklist)

## Boundary and ownership

Treat Temporal as a fourth entrypoint:

```text
entrypoints/temporal/
├── worker.py          # bootstrap, registration, shutdown
├── activities/        # thin adapters into application operations
├── workflows/         # deterministic SDK orchestration
└── dtos.py            # history-safe arguments and results
```

Keep SDK-decorated workflows here, not in `domain/workflows/`. They contain
vendor concepts such as activities, timers, signals, and retry policies.
Co-location makes the sandbox boundary explicit. Do not let domain modules or
unrelated entrypoints import worker bootstrap or sandboxed workflow modules;
non-worker processes may start a workflow by registered name through a gateway.

Do not confuse the two workflow abstractions:

| Application workflow | Temporal workflow |
| --- | --- |
| Coordinates use cases and gateways | Coordinates activities, timers, signals, and child workflows |
| May perform external calls outside UoWs | Performs no direct I/O |
| Runs normally once | Replays from immutable history |
| Depends on inward interfaces | Imports the SDK and history-safe contracts |

An activity may invoke an application use case or application workflow. The
application operation retains authorization, validation, and transaction
ownership; the Temporal workflow owns durable ordering only.

## Determinism and durable contracts

Workflow replay must schedule the same commands in the same order.

- Perform no database, network, filesystem, subprocess, environment, or vendor
  SDK I/O. Schedule activities instead.
- Never read `Config`, mutable globals, caches, or process state. Pass durable
  decisions through workflow input or activity results.
- Use workflow-safe time, UUID, random, sleep, and condition APIs rather than
  their ordinary Python equivalents when they affect history.
- Sort sets and other unordered inputs before scheduling parallel work. Persist
  results in explicit deterministic order.
- Keep workflow imports and every traversed package `__init__.py` side-effect
  free. Importing a leaf module still executes parent initializers.
- Use `workflow.unsafe.imports_passed_through()` only for deterministic,
  side-effect-free modules. Pydantic can be passed through; passthrough does not
  cure import-time mutation. Never disable the sandbox to hide an import error.
- Keep activity adapters out of the workflow import graph when they pull in DI
  or infrastructure. Schedule a registered activity name or import a lightweight
  contract module.

Use small, stable DTOs for workflow/activity arguments, results, signals, and
durable failures:

- Pass IDs, immutable snapshots, versions, and object-storage keys.
- Never pass entities, ORM models, repositories, UoWs, clients, requests, bytes,
  or large generated content. Persist large artifacts and pass references.
- Prefer additive fields with defaults; version a contract when meaning changes.
- Keep PII and message content out of search attributes.

This is primarily a replay-compatibility boundary, not a sandbox workaround:
later deployments must still decode historical payloads.

## Activities and worker DI

Treat each activity as a thin entrypoint adapter:

- Open one Dishka request scope per invocation and resolve one primary
  application operation.
- Keep Temporal context and DTO conversion at the boundary; keep policy and
  persistence inside the application operation.
- Never hold a UoW across slow I/O. Split work into atomic
  prepare/external/finalize operations when necessary.
- Make activities idempotent and fence completion with an operation ID, logical
  attempt, epoch, version, or current status. A stale completion is a no-op.
- Do not convert a decision-changing provider failure into success. Persist any
  user-visible error state, then re-raise for Temporal retry classification.

Create one async Dishka container per worker process and one request scope per
activity. Keep common providers but expose runtime-specific composition roots,
for example `make_http_container()`, `make_temporal_container()`, and
`make_celery_container()`. Do not leak an async Temporal client factory into a
sync Celery container.

The worker process should only assemble `Config`, client, bound activity
adapters, workflow registrations, limits, and graceful shutdown. Read all
settings through `Config`, including TLS, task queues, timeouts, retry bounds,
concurrency, shutdown drain, deployment identity, and metrics.

Give the worker its own database pool budget. Size pool and activity concurrency
together, and bound per-workflow fan-out so one execution cannot monopolize the
worker.

## Durable start and outbox dispatch

When accepted work must survive an API crash or Temporal outage, write the
authoritative state transition and START command to a Postgres outbox in the
same UoW. Return the durable queued state after commit. Never call Temporal in
that transaction.

Run the recovery dispatcher outside Temporal when it must function during a
Temporal outage. A Temporal Schedule cannot be its sole owner.

For each command:

1. Claim ready rows with `FOR UPDATE SKIP LOCKED` and record owner, lease,
   attempts, and last error.
2. Enforce aggregate sequence so CANCEL cannot overtake START.
3. Commit the claim before external RPC.
4. Immediately before RPC, lock command and aggregate, revalidate ownership and
   logical attempt, then renew the delivery lease.
5. Make deadline sweeps respect a live delivery lease.
6. Bound RPC timeout strictly below that lease.
7. ACK in a new UoW; release or expire the claim on failure.
8. Void commands for terminal or superseded attempts.

Steps 4–6 are one race-safety invariant. A pre-RPC read alone is insufficient:
another replica could terminalize the aggregate before the RPC. If the fence
wins, the sweep must defer; if the sweep wins, delivery must observe terminal
state and skip the call.

Give each logical execution a stable workflow ID such as
`resource/{resource_id}/{logical_attempt}`. Activity retries remain inside that
ID; explicit user re-execution increments the logical attempt. Use
`USE_EXISTING` plus `REJECT_DUPLICATE` only when a duplicate START means “the
same obligation.” Treat a closed duplicate as delivered only under that same
business invariant.

Add a database-owned acceptance deadline. Without contacting Temporal, its
sweep must be able to persist a complete terminal result, release retained
resources, void pending commands, and unblock the aggregate. Reconciliation may
later repair drift between Temporal and database state.

## Retries, cancellation, and history

- Set explicit workflow bounds and activity start-to-close or schedule-to-close
  timeouts. Prefer bounded activity retries to whole-workflow retries for
  user-visible work.
- Centralize `non_retryable_error_types` as tested class-name strings. Name
  domain-specific permanent errors; never classify every broad dependency type
  such as `ValidationError` as permanent.
- Bound transient retries because an activity replay can repeat billed work.
- Heartbeat long work well inside the timeout with small resumable details.
  Cancellation of a running activity also depends on heartbeats.
- Use `WAIT_CANCELLATION_COMPLETED` when cleanup must finish before the workflow
  advances. Finalize terminal state through a separately retryable activity and
  verify the SDK's current cancellation-safe pattern.
- Keep payloads and results small. Use heartbeats for resumable progress and an
  external relay for live UI events.
- Let the workflow mediate accumulated fan-out side effects so partial output is
  monotonic instead of racing across activities.
- Use Schedules for Temporal-dependent recurring work, `continue_as_new` before
  intentional long histories grow unbounded, and patch/versioning APIs for
  command-changing workflow edits.
- Treat Worker Deployment Versioning and DTO compatibility as separate duties.

## Testing and deployment

Cover three levels:

1. Test application state transitions, idempotency, and fencing without
   Temporal.
2. Use time-skipping workflow tests for timers, retries, signals, and
   cancellation; test activity adapters with fake application operations.
3. Replay captured histories with `Replayer`, and run worker integration tests
   for crash recovery, duplicate START, heartbeat timeout, and cleanup.

Add a sandbox test that imports every registered workflow under the production
runner. Test side-effect freedom rather than an import-name allowlist. For the
dispatcher, use concurrency barriers—not sleeps—to cover two claimants,
START-before-CANCEL, lease reclaim, sweep-versus-delivery, RPC timeout and retry,
command voiding, and operation deadline while Temporal is unavailable.

Before deployment, replay retained histories. Pin compatible server/UI/SDK
versions; make self-hosted schema upgrades explicit one-shot operations; secure
gRPC and UI; drain workers gracefully; and monitor pollers, schedule-to-start
latency, workflow-task failures, activity retries, oldest outbox command, and
database records stuck active.

## Review checklist

- [ ] Temporal code is isolated under its entrypoint boundary; workflow imports
      are deterministic and side-effect free.
- [ ] All I/O occurs in idempotent, fenced activities through application
      operations; no UoW spans an RPC.
- [ ] History contains small stable DTOs, not entities, clients, bytes, or PII.
- [ ] Workflow IDs, logical attempts, duplicate policies, retries, and deadlines
      match business semantics.
- [ ] Outbox ordering, lease renewal, RPC timeout, and sweep behavior form one
      tested race-safe invariant.
- [ ] Heartbeats, cancellation, and exhausted retries always reach complete
      replayable terminal state.
- [ ] Worker DI, pool capacity, fan-out, TLS, shutdown, and metrics are explicit.
- [ ] Time-skipping, replay, sandbox, crash, duplicate-delivery, and concurrency
      tests cover the durable boundaries.
