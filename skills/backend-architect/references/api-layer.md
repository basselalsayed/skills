# HTTP API entrypoint: routers, request schemas, authorization

## Router Conventions

- Keep routers under `entrypoints/http/routers/`; never create a top-level `routers/` package
- Construct each `APIRouter` with `route_class=DishkaRoute`
- Every endpoint MUST have `response_model` and `operation_id` (camelCase) — these drive OpenAPI / client-SDK generation
- Define `responses` dict for error models at both router and endpoint level
- Authenticate via the `AuthenticatedPrincipal` dependency; never pass a raw JWT or framework security object into a use case
- Request handlers consume **one primary application operation**: an atomic use case or a workflow. Perform resource authorization inside an atomic use case's UoW.

## Request Body Schemas

Two distinct base classes — use the right one:

- **`BaseParams`** — for request body schemas used in router signatures (`body: XParams`). Pydantic alias generator applies `to_camel` so the wire format is camelCase. Define these directly above their endpoint in the router file, not in `domain/schemas/`.
- **`BaseSchema`** — for AI/orchestrator/internal schemas that stay snake_case throughout. Lives in `domain/schemas/`.

```python
# ✅ In the router file, above the endpoint
class CreateTweetParams(BaseParams):
    text: str
    tags: list[TagRef]

# ✅ Internal / AI schema
class TweetSuggestionSchema(BaseSchema):
    suggested_text: str
    reasoning: str
```

## Authentication and authorization

The HTTP dependency validates the bearer JWT and converts its trusted claims into
an immutable `Principal`. It does not load an owned entity:

```python
@router.get("/{tweet_id}", response_model=TweetEntity, operation_id="getTweet")
async def get_tweet(
    tweet_id: UUID,
    principal: AuthenticatedPrincipal,
    use_case: FromDishka[GetTweetUseCase],
) -> TweetEntity:
    return await use_case(tweet_id=tweet_id, actor_id=principal.actor_id)
```

Load the resource and enforce ownership/permissions inside the same UoW used for
the business operation. Return the same application-level not-found result for a
missing or unauthorized owned resource when existence must not be disclosed.
Keep the reusable principal dependency in `entrypoints/http/dependencies.py`.
See [authentication-authorization.md](authentication-authorization.md) for JWT
validation, token freshness, and critical-flow rules.
