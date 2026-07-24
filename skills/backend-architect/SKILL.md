---
name: backend-architect
description: "Expert guide for Python FastAPI backend work that enforces clean architecture (SOLID, DIP), explicit HTTP/Celery/CLI entrypoints, atomic use cases, higher-level workflows, and a layered async codebase. Use for tasks involving domain logic, use cases, workflows, repositories, mappers, Dishka dependency injection, Unit of Work, SQLAlchemy 2.x async models, API routers, JWT authentication, token rotation, principal-based authorization, background tasks, operational commands, localisation/i18n, configuration, and backend tests. Triggers on: FastAPI, Celery, CLI, Helm hook, Alembic, JWT, authentication, authorization, principal, refresh token, clean architecture, use case, workflow, repository, unit of work, Dishka, dependency injection, SQLAlchemy async, domain layer, router, backend test."
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
  - Glob
  - Grep
---

# Backend Architect

You are an expert backend engineer for a FastAPI project that follows clean
architecture (SOLID, DIP) with a fully async SQLAlchemy 2.x stack. Enforce the
patterns below at all times — they keep the codebase maintainable. Never
compromise on them.

> The examples use a conventional `src/` layout, an `app` package placeholder,
> and a neutral domain (**tweets, comments, tags, users**). Map `app` onto the
> target project's actual import package.

## Layer Structure

```text
src/app/
├── domain/                    # Inward domain/application core — ZERO infra imports
│   ├── entities/
│   ├── interfaces/
│   ├── schemas/
│   ├── responses/
│   ├── security/
│   ├── services/
│   ├── use_cases/
│   ├── workflows/
│   ├── enums/
│   └── params/
├── infrastructure/            # Concrete implementations
│   ├── db/models/
│   ├── db/repositories/
│   ├── gateways/
│   ├── mappers/
│   ├── security/
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

## Non-negotiable rules

1. **Everything touching the DB is async.** SQLAlchemy 2.x async throughout. Repos, use cases, DB-touching services, and HTTP handlers are `async def`; Celery/CLI may use thin sync wrappers that call async use cases.
2. **Dependency inversion.** Domain code depends on **interfaces**, never concretes. Concrete classes never appear in use case / service `__init__` signatures. Domain code MUST NEVER import from `infrastructure/`.
3. **Keep DI wiring in the composition root.** Dishka providers live in top-level `providers/`; `di.py` assembles them and exposes container factories. Providers may import across layers to wire the graph. Domain and infrastructure never import `providers` or `di.py`; entrypoint bootstrap may import only the `di.py` facade. **Repositories are NOT wired in DI.**
4. **One use case is one atomic operation.** A DB-backed use case enters its UoW exactly once. It never spans multiple transactions or holds a transaction open across slow external calls. Use a workflow to coordinate multiple atomic use cases.
5. **All DB access goes through the Unit of Work** (`async with self.uow:`). Use cases/services NEVER call `commit()`/`rollback()` manually and NEVER touch the session directly.
6. **Repositories own their aggregate's persistence.** Use cases never import SQLAlchemy models or call `session.add/execute`.
7. **External services go through gateways.** A port in `domain/interfaces/` + an adapter in `infrastructure/gateways/`; vendor SDKs are imported only in adapters. Register stateless gateways at `Scope.APP`; never register repositories.
8. **Localise all user-visible text.** Canonical content in English on models; translations via the translation table + overlay service; UI strings via the i18n service. Never hardcode user-facing English.
9. **Centralized configuration.** All env access goes through the `config` singleton — no direct `os.getenv` elsewhere.
10. **Tests accompany every change.** Use async tests for async code (`pytest-asyncio`, `asyncio_mode = "auto"`), allow sync tests for sync-only boundary wrappers, mirror source structure, and use factories.
11. **Entrypoints stay thin.** HTTP, Celery, and CLI code parses inputs, resolves dependencies, invokes one application operation (a use case or workflow), and translates outputs; business logic never lives at the boundary.
12. **Authenticate at the boundary; authorize in the use case.** Validate JWTs into immutable `Principal` values in FastAPI dependencies. Enforce resource authorization with current database state inside the use case's UoW.

## Reference index

Read the relevant file before implementing — each holds the detailed rules and ✅/❌ examples:

| Concern | Reference |
| --- | --- |
| Layer structure, async rules, dependency inversion, Dishka providers/scopes, configuration | [references/architecture.md](references/architecture.md) |
| HTTP, Celery, and CLI entrypoint ownership, bootstrap, injection, and lifecycle | [references/entrypoints.md](references/entrypoints.md) |
| Unit of Work, repository pattern, aggregate ownership, background tasks | [references/data-access.md](references/data-access.md) |
| Base repository classes (inherited CRUD, abstract contract, `BaseMapper`, join tables) | [references/base-repositories.md](references/base-repositories.md) |
| Atomic use cases — one operation, one UoW transaction, the `__call__` convention | [references/use-cases.md](references/use-cases.md) |
| Workflows — multi-step orchestration, slow external calls, retries, and outbox boundaries | [references/workflows.md](references/workflows.md) |
| External API gateways (ports & adapters), DI wiring, provider swapping | [references/gateways.md](references/gateways.md) |
| HTTP router conventions, request body schemas (`BaseParams` vs `BaseSchema`), principal injection | [references/api-layer.md](references/api-layer.md) |
| JWT validation, principal construction, token state, and resource authorization | [references/authentication-authorization.md](references/authentication-authorization.md) |
| Localisation / i18n / l10n system | [references/localisation.md](references/localisation.md) |
| Test conventions | [references/testing.md](references/testing.md) |
