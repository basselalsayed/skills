# Tests

- Run tests with your project's configured test command (e.g. `pytest`)
- Mirror source structure under `tests/` (e.g. `domain/use_cases/` → `tests/domain/use_cases/`)
- Always write or update tests when adding or refactoring features
- Use `factory-boy` factories in `tests/factories/`
- Use `conftest.py` fixtures for session, DI clone, and UoW setup
- All test functions are `async def` — `pytest-asyncio` runs with `asyncio_mode = "auto"`
