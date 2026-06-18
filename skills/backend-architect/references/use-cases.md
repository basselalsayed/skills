# Use cases

A use case is an **async callable class** that orchestrates one unit of domain
logic. One use case = one entrypoint.

## The `__call__` convention

The behaviour lives in `async def __call__(...)`, **not** a named method like
`execute()` or `run()`. The instance is invoked like a function — so a router
calls `await use_case(...)` directly:

```python
# domain/use_cases/tweet/create_tweet.py
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
@router.post("/", response_model=TweetEntity, operation_id="createTweet")
async def create_tweet(
    body: TweetCreateParams,
    use_case: CreateTweetUseCase = FASTAPI_DI.depends(CreateTweetUseCase),
):
    return await use_case(body)        # ✅ the instance is called like a function
    # ❌ NOT: await use_case.execute(body) / use_case.run(body)
```

## Rules

1. **Dependencies via `__init__`, as interfaces.** Take `UnitOfWorkInterface` plus domain-service **interfaces** — never concretes. Lagom auto-resolves them (see [architecture.md](architecture.md)).
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
4. **Receive already-authorized entities, not raw ids.** The router's authz dep passes the `Owned*` entity; the use case doesn't re-check ownership (see [api-layer.md](api-layer.md)).
5. **One primary use case per handler.** Keep each use case focused on a single operation.

## Why `__call__`

- Makes use cases **first-class callables** — pass them around and invoke uniformly.
- Gives each use case **one obvious entrypoint** (no guessing between `execute`/`handle`/`run`).
- Lets routers treat an injected use case as a plain async function: `await use_case(...)`.
- Keeps DI wiring uniform — every use case is constructed the same way and called the same way.
