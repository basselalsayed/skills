# Tests

- Run tests with your project's configured test command (e.g. `pytest`)
- Mirror source structure under `tests/` (e.g. `src/app/domain/use_cases/` → `tests/domain/use_cases/`, `src/app/domain/workflows/` → `tests/domain/workflows/`, `src/app/entrypoints/http/` → `tests/entrypoints/http/`)
- Always write or update tests when adding or refactoring features
- Use `factory-boy` factories in `tests/factories/`
- Use `conftest.py` fixtures for sessions, a fresh Dishka container, and UoW setup
- Test async code with `async def` under `pytest-asyncio` and `asyncio_mode = "auto"`; sync-only Celery/CLI wrapper tests may use `def`

## Dishka fixtures

Dishka containers are immutable after creation. Append a test provider to the
production provider set, mark each replacement with `override=True`, and close
every container explicitly:

```python
class TestProvider(Provider):
    @provide(scope=Scope.APP, override=True)
    def translation_gateway(self) -> TranslationGatewayInterface:
        return FakeTranslationGateway()


@pytest_asyncio.fixture
async def container():
    container = make_async_container(TestProvider())
    yield container
    await container.close()
```

For HTTP tests, pass a container built with the override provider to
`create_app(container)` and let the app lifespan close it. For lower-level
container tests, use the fixture above. Give each container exactly one cleanup
owner; do not reuse an application or container across tests. Test HTTP routers
through the client, Celery task wrappers at the task boundary, and CLI modules
through their command entrypoint. Assert that:

- request-scoped dependencies do not leak between requests/tasks
- application-scoped fakes are reused only within their container
- container cleanup runs on success and failure
- repositories cannot be resolved directly from Dishka

For authentication and authorization, test:

- valid JWT claims map to the expected immutable `Principal`
- invalid signature, algorithm, issuer, audience, expiry, issued-at/not-before,
  or token purpose returns 401
- refresh tokens are rejected by the access-token dependency and vice versa
- optional authentication returns `None` only when credentials are absent;
  presented invalid credentials return 401
- ordinary endpoints avoid token-store reads when local validation is the policy
- critical endpoints consult current revocation/account/permission state
- resource authorization runs inside the use case and returns the same 404 for missing and unauthorized owned resources
- refresh rotation consumes the old token and stores its replacement atomically
- replacement-storage failure rolls back consumption of the old refresh token
- concurrent refresh attempts allow one rotation and treat the other as replay
- persisted session records never contain raw bearer or refresh credentials

For use cases and workflows, test:

- a successful DB-backed use case commits one transaction
- any uncaught failure rolls back that complete transaction
- a workflow's external call runs with no active DB session
- prepare/finalize version conflicts and duplicate completion are handled
  according to the documented idempotency policy
- retrying a workflow does not duplicate persisted state or external effects
