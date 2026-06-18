# Data access: Unit of Work, repositories, background tasks

## Unit of Work (MANDATORY — no exceptions)

ALL database access MUST go through the Unit of Work.

- `UnitOfWorkInterface` (domain/interfaces/) is the abstract contract; `UnitOfWork` (infrastructure/) is the implementation
- `UnitOfWorkInterface` is an `AbstractAsyncContextManager` — always use `async with self.uow:`
- On `__aenter__`: builds a fresh `AsyncSession` from the `async_sessionmaker` factory, then constructs all repos bound to that session
- On `__aexit__`: auto-commits on success, auto-rollbacks on exception, **closes** the session, and **deletes all repo attribute references** so any post-exit access raises `AttributeError` fast
- Use cases and services MUST NEVER call `commit()` or `rollback()` manually
- **`self.uow.X` (e.g. `self.uow.tweets`) only exists between `__aenter__` and `__aexit__`** — accessing repos outside the block raises `AttributeError` by design
- Repositories are NOT in DI and are NOT injectable directly — they are only accessible via `self.uow.<repo_name>` inside an active context

```python
class CreateTweetUseCase:
    def __init__(self, uow: UnitOfWorkInterface, tweet_service: TweetServiceInterface):
        self.uow = uow
        self.tweet_service = tweet_service

    async def __call__(self, body: CreateTweetParams, user: UserEntity) -> TweetEntity:
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

### Multiple `async with` blocks

Multiple `async with self.uow:` blocks across a long-running operation are a code smell. They usually mean either (a) authz retrieval that should move to a router dep, or (b) the use case is doing too much. Acceptable exceptions:

- Background batchers that release a connection between external API calls
- Use cases with intentional async work (e.g. AI calls) between two separate transactions

### Background tasks

Background/Celery tasks are sync at the top level. Acquire a fresh UoW per chunk via a `Callable[[], UnitOfWorkInterface]` factory — do not share a UoW instance across chunks:

```python
# ✅ Pattern for any background task module
def process_batch(uow_factory: Callable[[], UnitOfWorkInterface], ids: list[str]) -> None:
    asyncio.run(_process_batch_async(uow_factory, ids))

async def _process_batch_async(uow_factory, ids):
    async with uow_factory() as uow:
        ...
```

## Repository Pattern

Repositories extend `BaseRepository[ModelType, EntityType, MapperType]` and implement a domain interface. Must define `get_entity_key`, `get_model_key`, `_get_existing_models_by_key`. All methods are `async def`.

### Aggregate ownership

A repository owns its aggregate's persistence entirely. `TweetRepository.create(tweet_entity)` persists the tweet **plus** its `tweet_tags` and `tweet_mentions` join rows atomically. Cross-aggregate references (Tag, mentioned User) must be resolved by the use case via the appropriate repos (`uow.tags.get_or_create(...)`, `uow.mentions.get_or_create(...)`) *before* calling `tweets.create(...)`.

Use cases MUST NEVER:
- Import SQLAlchemy models
- Call `session.add(...)` or `session.execute(...)` directly

That is a clean-architecture violation — all persistence goes through repository methods.
