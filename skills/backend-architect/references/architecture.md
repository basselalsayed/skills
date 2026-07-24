# Architecture: layers, async, DI, use cases, config

## Layer Structure

```text
src/app/
├── domain/                    # Inward domain/application core — ZERO infra imports
│   ├── entities/              # Pydantic BaseEntity (camelCase alias)
│   ├── interfaces/            # Abstract repos, services, and gateways
│   ├── schemas/               # Internal schemas (BaseSchema, snake_case)
│   ├── responses/             # API response models
│   ├── security/              # Principal and authorization policy types
│   ├── services/              # Domain services
│   ├── use_cases/             # Async callable classes with __call__
│   ├── workflows/             # Multi-step application orchestration
│   ├── enums/
│   └── params/
├── infrastructure/            # Concrete implementations
│   ├── db/models/             # SQLAlchemy ORM (Base, UUID pk)
│   ├── db/repositories/       # BaseRepository[Model, Entity, Mapper]
│   ├── gateways/              # External-system adapters
│   ├── mappers/
│   ├── security/              # Token/cryptography adapters
│   └── unit_of_work.py
├── providers/                 # Composition-only Dishka provider groups
│   ├── application.py
│   ├── configuration.py
│   ├── database.py
│   ├── gateways.py
│   └── security.py
├── entrypoints/               # Thin delivery adapters
│   ├── http/
│   │   ├── app.py
│   │   ├── dependencies.py
│   │   └── routers/
│   ├── celery/
│   │   ├── app.py
│   │   └── tasks/
│   └── cli/
└── di.py                      # Composition-root facade
```

`src` is the source-layout directory; `app` is the import package placeholder.
In this convention, `domain/` contains both domain rules (entities, value
objects, services) and inward application rules (use cases and workflows).
Dependencies still point inward: workflows may call use cases, but use cases and
domain services never import workflows.
For entrypoint ownership and bootstrap examples, see [entrypoints.md](entrypoints.md).

## Everything Is Async

The entire backend is SQLAlchemy 2.x async. There are no sync DB operations anywhere.

- All repository methods are `async def` and use `await` for every DB call
- All use case `__call__` methods are `async def`
- Domain services that touch the DB are `async def`
- All router handlers are `async def`
- All DB ops at call sites use `await self.uow.X.method(...)`
- Tests for async code use `pytest-asyncio` with `asyncio_mode = "auto"`; sync-only boundary-wrapper tests may use `def`
- Celery tasks and CLI launchers may stay sync at the outermost boundary and call async use cases via `asyncio.run(...)`

Never write sync-style DB code. If you see `def get(self, ...)` on a repository, it must become `async def get(self, ...)`.

## Dependency Inversion (SOLID — non-negotiable)

All domain code depends on **abstractions (interfaces)**, never on concrete implementations.

**Rules:**

1. Use cases and services MUST type-hint dependencies as interfaces (`UnitOfWorkInterface`, `TweetServiceInterface`, etc.)
2. Concrete classes MUST NOT appear in `__init__` signatures of use cases or services
3. Interface → concrete mappings exist only in the composition root: Dishka providers under top-level `providers/`, assembled by `di.py`
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

## Dependency Injection (Dishka)

Put providers outside every production layer because they compose those layers.
They may import domain interfaces and services, infrastructure adapters, use
cases, and workflows. Domain and infrastructure never import from `providers/`
or `di.py`. Entrypoint bootstrap modules may import the container factories from
`di.py`, but entrypoints never import provider modules directly. Keep provider
construction synchronous so the same provider set works with FastAPI's async
container and Celery's sync container.

Keep `providers/__init__.py` empty or minimal. Do not make `infrastructure`
re-export providers and do not make provider modules import one another.
`di.py` imports each provider class directly and is the only module that owns
production assembly order.

- `configuration.py`: the configured `Config` instance
- `database.py`: engine/sessionmaker and other application-scoped DB factories
- `application.py`: UoW, domain services, use cases, and workflows
- `gateways.py`: interface-to-adapter mappings for external systems
- `security.py`: token, password, and cryptography port-to-adapter mappings

```python
# providers/application.py
from dishka import Provider, Scope, provide, provide_all


class ApplicationProvider(Provider):
    scope = Scope.REQUEST

    uow = provide(UnitOfWork, provides=UnitOfWorkInterface)
    tweet_service = provide(TweetService, provides=TweetServiceInterface)
    operations = provide_all(
        CreateTweetUseCase,
        GetTweetUseCase,
        GenerateTweetWorkflow,
    )

    # ❌ Never provide TweetRepository or TweetRepositoryInterface here.
```

Use these scope rules:

- `Scope.APP`: configuration, engine/sessionmaker, stateless gateway clients, and other application-lifetime objects
- `Scope.REQUEST`: UoW, use cases, and anything that depends on request-scoped objects
- A stateless domain service may use `Scope.APP` only when its entire dependency graph is also application-scoped
- Repositories have no Dishka provider; `UnitOfWork.__aenter__` constructs them

A DB-backed use case enters its request-scoped UoW exactly once. The HTTP
authentication dependency and workflows do not use a UoW: resource authorization
belongs inside an atomic use case, while workflows call multiple use cases.
Every use-case invocation therefore owns one fresh `AsyncSession`.

Assemble provider groups behind `di.py`; never expose a mutable global container:

```python
# di.py
from dishka import AsyncContainer, Container, Provider
from dishka import make_async_container as dishka_make_async_container
from dishka import make_container as dishka_make_container


def _providers() -> tuple[Provider, ...]:
    return (
        ConfigurationProvider(),
        DatabaseProvider(),
        GatewayProvider(),
        SecurityProvider(),
        ApplicationProvider(),
    )


def make_async_container(*overrides: Provider) -> AsyncContainer:
    return dishka_make_async_container(*_providers(), *overrides)


def make_sync_container(*overrides: Provider) -> Container:
    return dishka_make_container(*_providers(), *overrides)
```

Append test providers after production providers and mark replacement factories
with `override=True`. Dishka validates the assembled graph when the container is
created. See [entrypoints.md](entrypoints.md) for framework integration and
[gateways.md](gateways.md) for external adapters.

## Use Cases

Async callable classes that orchestrate domain logic:

- Receive `UnitOfWorkInterface` + domain service **interfaces** via `__init__` (never concretes)
- Implement `async def __call__(...)` with typed input/output
- Enter the UoW exactly once when the operation touches the database
- Receive authenticated actor context and authorize resources inside the UoW

For the `__call__` convention and atomicity rules, see
[use-cases.md](use-cases.md). For operations requiring multiple transactions or
slow external work, see [workflows.md](workflows.md).

## Configuration

Centralize all environment access in the `Config` object in `config.py` and
register the configured instance at `Scope.APP`. Direct `os.getenv` calls
outside the configuration module are forbidden.

```python
class ConfigurationProvider(Provider):
    @provide(scope=Scope.APP)
    def config(self) -> Config:
        return config

# ✅ Correct
threshold = config.some_threshold

# ❌ Wrong
threshold = float(os.getenv("SOME_THRESHOLD", "0.9"))
```
