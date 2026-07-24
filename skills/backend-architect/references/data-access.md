# Data access: Unit of Work, repositories, background tasks

## Unit of Work (MANDATORY — no exceptions)

ALL database access MUST go through the Unit of Work.

- `UnitOfWorkInterface` (domain/interfaces/) is the abstract contract; `UnitOfWork` (infrastructure/) is the implementation
- `UnitOfWorkInterface` is an `AbstractAsyncContextManager` — always use `async with self.uow:`
- On `__aenter__`: builds a fresh `AsyncSession` from the `async_sessionmaker` factory, then constructs all repos bound to that session
- On `__aexit__`: auto-commits on success, auto-rollbacks on exception, **closes** the session, and **deletes all repo attribute references** so any post-exit access raises `AttributeError` fast
- Use cases and services MUST NEVER call `commit()` or `rollback()` manually
- **`self.uow.X` (e.g. `self.uow.tweets`) only exists between `__aenter__` and `__aexit__`** — accessing repos outside the block raises `AttributeError` by design
- Repositories have no Dishka providers and are NOT injectable directly — they are only accessible via `self.uow.<repo_name>` inside an active context
- The UoW may be cached at Dishka `Scope.REQUEST`, but one DB-backed use-case invocation enters it exactly once and receives a fresh session

```python
class CreateTweetUseCase:
    def __init__(self, uow: UnitOfWorkInterface, tweet_service: TweetServiceInterface):
        self.uow = uow
        self.tweet_service = tweet_service

    async def __call__(self, body: CreateTweetParams, actor_id: UUID) -> TweetEntity:
        tweet_entity = self.tweet_service.create_entity(body, actor_id)
        async with self.uow:
            tag_entities = [await self.uow.tags.get_or_create(t) for t in body.tags]
            mention_entities = [
                await self.uow.mentions.get_or_create(m) for m in body.mentions
            ]
            tweet = await self.uow.tweets.create(tweet_entity)
        return tweet

# ❌ WRONG — never inject repos directly
class BadUseCase:
    def __init__(self, tweet_repo: TweetRepositoryInterface): ...

# ❌ WRONG — never manually commit
async with self.uow:
    await self.uow.tweets.create(entity)
    await self.uow.commit()

# ❌ WRONG — never access repos outside the block
async with self.uow:
    tweet = await self.uow.tweets.get(id)
second_tweet = await self.uow.tweets.get(other_id)  # AttributeError

# ❌ WRONG — never access session directly
session.execute(select(TweetModel))
```

### One transaction per use case

A DB-backed use case contains exactly one `async with self.uow:` block. Load,
authorize, mutate, and persist the operation in that block. Do not enter the UoW
twice, and do not hide extra transactions in a domain service.

When an operation needs multiple commits, batch/chunk boundaries, or a slow
external call between database steps, split the steps into separate atomic use
cases and coordinate them with a workflow. See [workflows.md](workflows.md).

### Background tasks

Celery tasks are sync at the top level and receive a request-scoped async use
case or workflow from Dishka. Bridge to async once at the boundary. Batch jobs
use a workflow that invokes one atomic use case per chunk:

```python
# ✅ entrypoints/celery/tasks/tweets.py
@celery_app.task
def process_batch(
    ids: list[str],
    workflow: FromDishka[ProcessTweetBatchWorkflow],
) -> None:
    asyncio.run(workflow(ids))


# ✅ domain/workflows/process_tweet_batch.py
async def __call__(self, ids: list[str]) -> None:
    for chunk in batched(ids, 100):
        await self.process_chunk(chunk)


# ✅ domain/use_cases/tweet/process_tweet_chunk.py
async def __call__(self, ids: list[str]) -> None:
    async with self.uow:
        await self.uow.tweets.process(ids)
```

The workflow never receives the UoW or repositories. Each use-case call owns its
transaction. See [entrypoints.md](entrypoints.md) for Celery container setup.

## Repository Pattern

Repositories extend `BaseRepository[ModelType, EntityType, MapperType]` and implement a domain interface. Must define `get_entity_key`, `get_model_key`, `_get_existing_models_by_key`. All methods are `async def`. For the full base-class API (inherited CRUD, the abstract contract, `BaseMapper`, and the join-table `BaseTableRepository`), see [base-repositories.md](base-repositories.md).

### Aggregate ownership

A repository owns its aggregate's persistence entirely. `TweetRepository.create(tweet_entity)` persists the tweet **plus** its `tweet_tags` and `tweet_mentions` join rows atomically. Cross-aggregate references (Tag, mentioned User) must be resolved by the use case via the appropriate repos (`uow.tags.get_or_create(...)`, `uow.mentions.get_or_create(...)`) *before* calling `tweets.create(...)`.

Use cases MUST NEVER:
- Import SQLAlchemy models
- Call `session.add(...)` or `session.execute(...)` directly

That is a clean-architecture violation — all persistence goes through repository methods.
