# API layer: routers, request schemas, authorization

## Router Conventions

- Every endpoint MUST have `response_model` and `operation_id` (camelCase) — these drive OpenAPI / client-SDK generation
- Define `responses` dict for error models at both router and endpoint level
- Auth via `AuthenticatedUser` dependency or router-level `dependencies=[Depends(get_current_user)]`
- Request handlers should consume **at most one primary use case**. The only acceptable second dependency is an authz-style retrieval (see Authorization Dependencies below)

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

## Authorization Dependencies

Authz lives in router deps, not inside use cases. Typed FastAPI deps like `OwnedTweet` and `OwnedComment`:

- Resolve a path param (`tweet_id`, `comment_id`) into the typed entity
- Return 404 (not 403) if the resource doesn't exist OR isn't owned by the current user — existence is never leaked

Use cases receive the already-authorized **entity**, not `(id, user_id)`.

```python
OwnedTweet = Annotated[TweetEntity, Depends(authorize_owned_tweet)]

@router.get("/{tweet_id}", response_model=TweetEntity, operation_id="getTweet")
async def get_tweet(
    tweet: OwnedTweet,
    use_case: GetTweetUseCase = FASTAPI_DI.depends(GetTweetUseCase),
):
    return await use_case(tweet)
```

Keep `Owned*` deps in your resource router's dependencies module (or inline in the router for a single resource). Authz retrievals are the only acceptable "second use case" in a handler — and even then, prefer making them a dep.
