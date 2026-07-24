# Entrypoints: HTTP, Celery, and CLI

Entrypoints are thin delivery adapters. They may import domain/application types
and the top-level composition root, but inward layers never import an entrypoint.
Keep argument parsing, framework setup, dependency resolution, operation
invocation, and response/error translation here. Keep business logic in atomic
use cases and multi-step orchestration in workflows.

## Contents

- [Layout and ownership](#layout-and-ownership)
- [HTTP](#http)
- [Celery](#celery)
- [CLI and Helm hooks](#cli-and-helm-hooks)

## Layout and ownership

```text
src/app/entrypoints/
├── http/
│   ├── app.py             # FastAPI construction, middleware, router inclusion
│   ├── dependencies.py    # Shared HTTP-only dependencies
│   └── routers/           # Resource routers and transport-only dependencies
├── celery/
│   ├── app.py             # Celery and Dishka worker setup
│   └── tasks/             # Sync task wrappers
└── cli/                   # Executable operational command modules
```

- HTTP owns transport schemas, JWT authentication dependencies, middleware,
  status codes, and API routers. Resource authorization stays in use cases.
- Celery owns task names, serialization, retries, and sync-to-async wrappers.
- CLI owns command-line arguments and exit codes for migrations, Helm hooks,
  maintenance jobs, and one-off operations.
- An entrypoint invokes one primary application operation: an atomic use case or
  a workflow. Do not put persistence, vendor SDK calls, or reusable business
  rules in an entrypoint.

## HTTP

Use an async container. Give every router `DishkaRoute` so handlers can declare
`FromDishka[T]` parameters without an `@inject` decorator:

```python
# entrypoints/http/routers/tweets.py
from dishka.integrations.fastapi import DishkaRoute, FromDishka
from fastapi import APIRouter


router = APIRouter(route_class=DishkaRoute)


@router.post("/", response_model=TweetEntity, operation_id="createTweet")
async def create_tweet(
    body: CreateTweetParams,
    principal: AuthenticatedPrincipal,
    use_case: FromDishka[CreateTweetUseCase],
) -> TweetEntity:
    return await use_case(body, actor_id=principal.actor_id)
```

Create and attach the container during application bootstrap, then close it in
the FastAPI lifespan:

```python
# entrypoints/http/app.py
from contextlib import asynccontextmanager

from dishka import AsyncContainer
from dishka.integrations.fastapi import setup_dishka
from fastapi import FastAPI

from app.di import make_async_container


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await app.state.dishka_container.close()


def create_app(container: AsyncContainer | None = None) -> FastAPI:
    app = FastAPI(lifespan=lifespan)
    app.include_router(tweets_router)
    setup_dishka(container=container or make_async_container(), app=app)
    return app
```

FastAPI `Depends` functions that consume Dishka dependencies require `@inject`,
even when the router uses `DishkaRoute`. Use that pattern to validate a bearer
JWT and construct `Principal`; do not perform resource authorization here. See
[authentication-authorization.md](authentication-authorization.md) for the
complete dependency, JWT validation rules, stateful-token freshness policy, and
use-case authorization example.

See the
[Dishka FastAPI integration](https://dishka.readthedocs.io/en/stable/integrations/fastapi.html)
for middleware-managed request scopes and WebSocket-specific handling.

## Celery

Celery task functions remain synchronous. Use `DishkaTask` so each task gets a
`Scope.REQUEST` child container, inject the async callable use case or workflow,
and bridge once with `asyncio.run(...)`:

```python
# entrypoints/celery/app.py
from celery import Celery, current_app
from celery.signals import worker_process_shutdown
from dishka import Container
from dishka.integrations.celery import DishkaTask, setup_dishka

from app.di import make_sync_container


celery_app = Celery("app", task_cls=DishkaTask)
setup_dishka(container=make_sync_container(), app=celery_app)


@worker_process_shutdown.connect()
def close_dishka(*_: object, **__: object) -> None:
    container: Container = current_app.conf["dishka_container"]
    container.close()
```

```python
# entrypoints/celery/tasks/tweets.py
import asyncio

from dishka.integrations.celery import FromDishka

from app.entrypoints.celery.app import celery_app


@celery_app.task
def process_tweets(
    tweet_ids: list[str],
    workflow: FromDishka[ProcessTweetsWorkflow],
) -> None:
    asyncio.run(workflow(tweet_ids))
```

All providers used by the sync Celery container must construct and finalize
synchronously. Dependencies may still expose async methods; the task wrapper
invokes those methods inside its event loop. Do not create or share an
`AsyncSession` at `Scope.APP`.

See the
[Dishka Celery integration](https://dishka.readthedocs.io/en/stable/integrations/celery.html)
for task injection and worker-scope management.

## CLI and Helm hooks

Place each executable command in `entrypoints/cli/` and expose it through the
project's console scripts or `python -m app.entrypoints.cli.<command>`. For an
async application operation, create one async container, enter one request
scope, and close the application container in `finally`:

```python
# entrypoints/cli/rebuild_search_index.py
import asyncio

from app.di import make_async_container


async def _main() -> None:
    container = make_async_container()
    try:
        async with container() as request_container:
            use_case = await request_container.get(RebuildSearchIndexUseCase)
            await use_case()
    finally:
        await container.close()


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
```

Keep Alembic configuration and migration scripts with database infrastructure.
A CLI module or Helm hook may invoke that migration runner, but must not embed
migration logic or import HTTP/Celery modules. Return a non-zero exit code by
letting failures propagate to the process boundary after container cleanup.
