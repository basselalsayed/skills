# Architecture: layers, async, DI, use cases, config

## Layer Structure

```
app/
├── domain/           # Business logic — ZERO infra imports allowed here
│   ├── entities/     # Pydantic BaseEntity (camelCase alias)
│   ├── interfaces/   # Abstract repos & services
│   ├── schemas/      # AI/orchestrator/internal schemas (BaseSchema, snake_case)
│   ├── responses/    # API response models
│   ├── services/     # Domain services (implement interfaces)
│   ├── use_cases/    # Async callable classes with __call__
│   ├── enums/
│   └── params/
├── infrastructure/   # Concrete implementations
│   ├── db/models/    # SQLAlchemy ORM (Base, UUID pk)
│   ├── db/repositories/  # BaseRepository[Model, Entity, Mapper]
│   ├── mappers/      # BaseMapper[Entity, Model]
│   └── unit_of_work.py
├── routers/          # Presentation layer
└── di.py             # Lagom DI container — only place interfaces map to concretes
```

## Everything Is Async

The entire backend is SQLAlchemy 2.x async. There are no sync DB operations anywhere.

- All repository methods are `async def` and use `await` for every DB call
- All use case `__call__` methods are `async def`
- Domain services that touch the DB are `async def`
- All router handlers are `async def`
- All DB ops at call sites use `await self.uow.X.method(...)`
- Tests use `pytest-asyncio` with `asyncio_mode = "auto"`; all test functions are `async def`
- Background/Celery tasks stay sync themselves but call into async via `asyncio.run(...)`

Never write sync-style DB code. If you see `def get(self, ...)` on a repository, it must become `async def get(self, ...)`.

## Dependency Inversion (SOLID — non-negotiable)

All domain code depends on **abstractions (interfaces)**, never on concrete implementations.

**Rules:**

1. Use cases and services MUST type-hint dependencies as interfaces (`UnitOfWorkInterface`, `TweetServiceInterface`, etc.)
2. Concrete classes MUST NOT appear in `__init__` signatures of use cases or services
3. `di.py` is the **only** place that maps interfaces → concrete implementations
4. Domain code MUST NEVER import from `infrastructure/`

```python
# ✅ Correct
class CreateTweetUseCase:
    def __init__(self, uow: UnitOfWorkInterface, tweet_service: TweetServiceInterface):
        self.uow = uow
        self.tweet_service = tweet_service

# ❌ Wrong — concrete in domain
class CreateTweetUseCase:
    def __init__(self, uow: UnitOfWork, tweet_service: TweetService): ...
```

## Dependency Injection (Lagom)

Wire in `di.py` — interfaces map to concretes, Lagom auto-resolves constructor deps at runtime.

The DI container knows about: `async_sessionmaker[AsyncSession]`, mappers, domain services, external gateways, the UoW itself, and use cases. **Repositories are NOT wired in DI** — they are only constructible through `UnitOfWork.__aenter__` (see [data-access.md](data-access.md)). For wiring external integrations (and the gateways-vs-repos-in-DI distinction), see [gateways.md](gateways.md).

```python
DI[UnitOfWorkInterface] = UnitOfWork
DI[TweetServiceInterface] = TweetService
DI[EmbeddingServiceInterface] = OpenAIEmbeddingService
DI[HashService] = Singleton(HashServiceImpl)
# ❌ Do NOT wire repos here — DI[TweetRepositoryInterface] = TweetRepository is wrong
```

Inject into routers via `FASTAPI_DI.depends()`. `FastApiIntegration(DI)` does **not** use `request_singletons=[AsyncSession]` — each `FASTAPI_DI.depends(...)` call resolves its use case (and therefore its UoW) with a fresh session:

```python
@router.post("/", response_model=TweetEntity, operation_id="createTweet")
async def create_tweet(
    body: TweetCreateParams,
    user: AuthenticatedUser,
    use_case: CreateTweetUseCase = FASTAPI_DI.depends(CreateTweetUseCase),
):
    return await use_case(body)
```

## Use Cases

Async callable classes that orchestrate domain logic:

- Receive `UnitOfWorkInterface` + domain service **interfaces** via `__init__` (never concretes)
- Implement `async def __call__(...)` with typed input/output
- Wrap ALL DB work in `async with self.uow:`
- Receive already-authorized entities from router deps, not raw IDs + user_id

For the `__call__` calling convention, router call sites, and full rules, see [use-cases.md](use-cases.md).

## Configuration

All env var access is centralized in the `__Config` singleton in `config.py`. Direct `os.getenv` calls outside that class are forbidden.

```python
from app.config import config

# ✅ Correct
threshold = config.some_threshold

# ❌ Wrong
threshold = float(os.getenv("SOME_THRESHOLD", "0.9"))
```
