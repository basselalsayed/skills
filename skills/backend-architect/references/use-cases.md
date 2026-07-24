# Use cases

A use case is an **async callable class** that performs one atomic business
operation. For a database-backed operation:

> One use case invocation = one UoW entry = one transaction.

A use case never coordinates multiple commits. Use a
[workflow](workflows.md) when an operation needs multiple transactions or a
slow external call between database steps.

## The `__call__` convention

The behaviour lives in `async def __call__(...)`, **not** a named method like
`execute()` or `run()`. The instance is invoked like a function — so a router
calls `await use_case(...)` directly:

```python
# src/app/domain/use_cases/tweet/create_tweet.py
class CreateTweetUseCase:
    """Create a tweet, resolving its tags first."""

    def __init__(self, uow: UnitOfWorkInterface, tweet_service: TweetServiceInterface):
        self.uow = uow
        self.tweet_service = tweet_service

    async def __call__(self, schema: TweetCreateSchema) -> TweetEntity:
        tweet_entity = self.tweet_service.schema_to_entity(schema)
        async with self.uow:
            for tt in tweet_entity.tags:
                tt.tag = await self.uow.tags.get_or_create(tt.tag)
                tt.tag_id = tt.tag.id
            await self.uow.tweets.create(tweet_entity)
            return await self.uow.tweets.get(tweet_entity.id)
```

At the call site (router), DI resolves the instance and the handler just calls it:

```python
from dishka.integrations.fastapi import FromDishka


@router.post("/", response_model=TweetEntity, operation_id="createTweet")
async def create_tweet(
    body: TweetCreateParams,
    use_case: FromDishka[CreateTweetUseCase],
):
    return await use_case(body)        # ✅ the instance is called like a function
    # ❌ NOT: await use_case.execute(body) / use_case.run(body)
```

## Rules

1. **Dependencies via `__init__`, as interfaces.** Take `UnitOfWorkInterface` plus domain-service **interfaces** — never concretes. Dishka resolves the registered constructor graph (see [architecture.md](architecture.md)).
2. **Typed input/output.** Accept params/entities, return an entity or `PageResponse[Entity]`:
   ```python
   class GetAllCommentsUseCase:
       def __init__(self, uow: UnitOfWorkInterface):
           self.uow = uow

       async def __call__(
           self, query: str | None, pagination: PaginationParams
       ) -> PageResponse[CommentEntity]:
           async with self.uow:
               if query:
                   return await self.uow.comments.search_by_text_paginated(query, pagination)
               return await self.uow.comments.get_all_paginated(pagination)
   ```
3. **Wrap DB work in `async with self.uow:`.** Never commit/rollback manually (see [data-access.md](data-access.md)).
4. **Authorize resources inside the UoW.** Receive the authenticated actor ID or `Principal`, load the resource, and enforce ownership/permissions in the same transaction as the operation (see [authentication-authorization.md](authentication-authorization.md)).
5. **Enter the UoW once.** A DB-backed invocation has exactly one `async with self.uow:` block. A pure operation that does not touch persistence has none.
6. **Keep slow external work outside the transaction.** Do not call an LLM, payment API, email provider, or another unreliable/slow system while the UoW is active. Split prepare/finalize steps into atomic use cases and coordinate them in a workflow.
7. **One application operation per handler.** Inject one use case for an atomic operation or one workflow for a multi-step operation.

## Transaction outcome

Returning from the UoW block commits. Raising from it rolls back. Catch expected
business failures only when the use case can still produce a valid atomic
outcome; let infrastructure failures escape so rollback occurs.

Do not return a success result until all state belonging to that atomic
operation has been persisted. Use an outbox record in the same transaction when
a message or external action must reliably follow the commit.

## Why `__call__`

- Makes use cases **first-class callables** — pass them around and invoke uniformly.
- Gives each use case **one obvious call surface** (no guessing between `execute`/`handle`/`run`).
- Lets routers treat an injected use case as a plain async function: `await use_case(...)`.
- Keeps DI wiring uniform — Dishka constructs every use case from typed constructor dependencies and each boundary calls it the same way.
