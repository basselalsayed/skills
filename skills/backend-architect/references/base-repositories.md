# Base repositories

Concrete repositories inherit from one of two base classes. Both bind to the
`AsyncSession` the Unit of Work owns (they're only ever constructed inside
`UnitOfWork.__aenter__` — see [data-access.md](data-access.md)).

| Base class | For | Backed by |
| --- | --- | --- |
| `BaseRepository[ModelType, EntityType, MapperType]` | entity / aggregate repositories | an ORM model |
| `BaseTableRepository[TableType, ParamsType]` | association / many-to-many join tables | a Core `Table` |

> The `class X[T: Bound]` form is Python 3.12+ generic syntax (PEP 695).

## `BaseRepository[ModelType, EntityType, MapperType]`

```python
class BaseRepository[ModelType: Base, EntityType: BaseEntity, MapperType: BaseMapper](ABC):
    def __init__(self, db: AsyncSession, model, entity, mapper): ...
```

Subclasses get a ready-made async CRUD surface and only supply their model,
entity, and mapper. All methods return **entities**, never ORM models — the
mapper is the boundary.

### Inherited API

| Method | What it does |
| --- | --- |
| `get(id) -> Entity \| None` | fetch one by id |
| `get_many(ids) -> list[Entity]` | fetch many by id |
| `get_all() -> list[Entity]` | fetch all |
| `get_all_paginated(PaginationParams) -> PageResponse[Entity]` | paginated fetch |
| `create(entity) -> Entity` | insert (assigns a UUID id if unset) |
| `create_many(entities) -> list[Entity]` | bulk insert |
| `update(entity) -> Entity` | upsert via `session.merge` |
| `create_or_update(entity) -> Entity` | update if the id exists, else create |
| `get_or_create(entity) -> Entity` | return existing match (by key) or create |
| `get_or_create_many(entities) -> list[Entity]` | batch key-based dedup + create |

### Abstract methods (you MUST implement)

These power the key-based dedup in `get_or_create` / `get_or_create_many`:

```python
def get_entity_key(self, entity: EntityType) -> str: ...
def get_model_key(self, model: ModelType) -> str: ...
async def _get_existing_models_by_key(self, keys: list[str]) -> list[ModelType]: ...
```

The "key" is the natural/business identity used to detect duplicates (e.g. a
tag's `name`), distinct from the surrogate UUID primary key.

## Writing a concrete repository

Extend `BaseRepository` **and** the domain interface, call `super().__init__`
with the model/entity/mapper, add any custom queries, and implement the three
key methods:

```python
class TagRepository(BaseRepository[TagModel, TagEntity, TagMapper], TagRepositoryInterface):
    def __init__(self, db: AsyncSession, mapper: TagMapper):
        super().__init__(db, TagModel, TagEntity, mapper)

    # Custom query — lives in the concrete repo, returns an entity
    async def get_by_name(self, name: str) -> TagEntity | None:
        stmt = select(self.model).where(self.model.name == name)
        model = (await self.db.execute(stmt)).scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    # Abstract impls — natural key is the tag name
    def get_entity_key(self, entity: TagEntity) -> str:
        return entity.name

    def get_model_key(self, model: TagModel) -> str:
        return model.name

    async def _get_existing_models_by_key(self, keys: list[str]) -> list[TagModel]:
        stmt = select(self.model).where(self.model.name.in_(keys))
        return list((await self.db.execute(stmt)).scalars().all())
```

## `BaseMapper[EntityType, ModelType]`

Each repository is constructed with a mapper that converts between the domain
entity and the ORM model. One mapper per aggregate.

```python
class BaseMapper[EntityType, ModelType](ABC):
    @abstractmethod
    def to_model(self, entity: EntityType) -> ModelType: ...
    @abstractmethod
    def to_entity(self, model: ModelType) -> EntityType: ...
    # provided:
    def to_models(self, entities: list[EntityType]) -> list[ModelType]: ...
    def to_entities(self, models: list[ModelType]) -> list[EntityType]: ...
```

Mappers are wired in DI as `Singleton`s and passed into the repo by the UoW.

## `BaseTableRepository[TableType, ParamsType]`

For many-to-many **join tables** that have no entity of their own (e.g.
`tweet_tags`, `tweet_mentions`). Operates on a Core `Table` with a Pydantic
params model describing one row:

```python
class BaseTableRepository(BaseTableRepositoryInterface[TableType, ParamsType]):
    def __init__(self, db: AsyncSession, table: TableType): ...

    async def add_entry(self, params: ParamsType) -> None:      # INSERT
        await self.db.execute(insert(self.table).values(params.model_dump()))

    async def remove_entry(self, params: ParamsType) -> None:   # DELETE matching all columns
        ...
```

Use it for the join rows an aggregate owns, e.g. linking a tweet to its tags.

## Conventions

- **Every method is `async`.** Use `await` for all DB calls.
- **Return entities, not models.** Map at the repo boundary; ORM models never leave the repository.
- **Custom queries live in the concrete repo** (`get_by_name`, search, etc.) — not in use cases.
- **Pagination** flows through `PaginationParams` → `PageResponse[Entity]`.
- **Natural key ≠ primary key.** The abstract key methods use business identity for dedup; the PK stays a surrogate UUID.
- **Repos are UoW-scoped.** They are not in DI and only exist inside `async with self.uow:` (see [data-access.md](data-access.md)).
