# Workflows: multi-step application orchestration

A workflow coordinates several atomic use cases and external calls. It is a
higher application abstraction, not a larger transaction.

## Contents

- [Use case versus workflow](#use-case-versus-workflow)
- [Rules](#rules)
- [Prepare, call, finalize](#prepare-call-finalize)
- [Reliability and concurrency](#reliability-and-concurrency)
- [Outbox and side effects](#outbox-and-side-effects)
- [Entrypoints and DI](#entrypoints-and-di)

## Use case versus workflow

Use an atomic use case when the operation can complete in one transaction:

```text
load + authorize + mutate + persist
└──────────── one UoW transaction ────────────┘
```

Use a workflow when the operation requires any of:

- a slow or unreliable LLM, payment, email, storage, or third-party API call
- multiple deliberate transaction boundaries
- chunked or batch processing
- retries, compensation, polling, or resumable progress

```text
prepare use case     external call       finalize use case
 transaction A       no DB session        transaction B
```

## Rules

1. Workflows are async callable classes with `async def __call__(...)`.
2. Workflows receive use cases and gateway interfaces through their constructor.
3. Workflows never receive a UoW, repository, SQLAlchemy session, or ORM model.
4. Each DB-backed use case entered by a workflow owns exactly one transaction.
5. Pass IDs, commands, immutable snapshots, and version values between steps;
   never pass a repository or transaction-bound ORM object.
6. Make every remotely retried step idempotent.
7. Treat partial completion as an explicit state, not an exceptional mystery.
8. Dependencies point upward only: workflows may call use cases; use cases and
   domain services never import or invoke workflows.

## Prepare, call, finalize

For a use case that needs database context, several LLM calls, and a final
mutation, split it into two atomic use cases:

```python
class GenerateTweetWorkflow:
    def __init__(
        self,
        prepare: PrepareTweetGenerationUseCase,
        generator: TweetGeneratorGatewayInterface,
        complete: CompleteTweetGenerationUseCase,
        fail: FailTweetGenerationUseCase,
    ) -> None:
        self.prepare = prepare
        self.generator = generator
        self.complete = complete
        self.fail = fail

    async def __call__(
        self,
        command: GenerateTweetCommand,
    ) -> TweetEntity:
        prepared = await self.prepare(command)  # transaction A

        try:
            draft = await self.generator.generate(prepared.prompt)  # no UoW
        except TweetGenerationError as error:
            await self.fail(
                FailTweetGenerationCommand(
                    operation_id=prepared.operation_id,
                    reason=type(error).__name__,
                )
            )
            raise

        return await self.complete(  # transaction B
            CompleteTweetGenerationCommand(
                operation_id=prepared.operation_id,
                expected_version=prepared.tweet_version,
                draft=draft,
            )
        )
```

`PrepareTweetGenerationUseCase` loads and authorizes the tweet, captures the
minimum immutable input needed by the gateway, and persists a pending operation.
`CompleteTweetGenerationUseCase` reloads current state, verifies the pending
operation and expected version, applies the result, and marks the operation
complete. Each contains one `async with self.uow:` block.

Do not keep a transaction open while the external call runs. Do not assume the
aggregate is unchanged when the workflow resumes: re-read and enforce a version,
state transition, or other concurrency policy during finalization.

## Reliability and concurrency

Choose orchestration durability deliberately:

- Use an in-process workflow when the whole call may safely fail and be retried.
- Use Celery or another durable runner when work must survive process failure.
- Persist an operation ID and status for long-running or user-visible work.
- Give each step an idempotency key and make duplicate completion harmless.
- Model compensation explicitly when an already-completed external action cannot
  be rolled back by a database transaction.

Do not catch every exception and report success. Persist failure state only when
that state is itself a valid atomic outcome, then re-raise or return a typed
workflow result according to the boundary contract.

## Outbox and side effects

Use an outbox when an external action must happen after a successful database
commit:

```python
class ApproveTweetUseCase:
    async def __call__(self, command: ApproveTweetCommand) -> TweetEntity:
        async with self.uow:
            tweet = await self.uow.tweets.get_owned(
                command.tweet_id,
                command.actor_id,
            )
            if tweet is None:
                raise TweetNotFound()
            tweet.approve()
            await self.uow.tweets.update(tweet)
            await self.uow.outbox.add(TweetApproved.from_tweet(tweet))
            return tweet
```

The state change and outbox row commit together. A separate worker publishes the
event with retries and idempotency. Do not publish to a broker inside the UoW and
assume the database commit will also succeed.

Use a workflow for request/response coordination around an external result; use
an outbox for reliable post-commit delivery. A workflow may itself invoke use
cases that write outbox records.

## Entrypoints and DI

An HTTP handler, Celery task, or CLI command invokes one primary application
operation: either an atomic use case or a workflow. It never manually sequences
the workflow's internal steps.

Register workflows in `providers/application.py` at `Scope.REQUEST`. A workflow
inherits request scope because it depends on request-scoped use cases, but it
does not own the Dishka scope or transaction lifecycle.
