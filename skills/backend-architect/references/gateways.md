# External API gateways (infrastructure)

External services (translation, email/notifications, LLMs, storage, payments) are
integrated with the **ports-and-adapters** pattern:

- The **port** is an abstract interface in `domain/interfaces/`.
- The **adapter** is the concrete gateway in `infrastructure/gateways/` that wraps the vendor SDK.
- Domain code depends only on the port. The vendor SDK is imported **only** inside the adapter.

This keeps the domain free of third-party detail and lets you swap providers without
touching business logic.

## Port (domain/interfaces/)

An `ABC` with `async` abstract methods. The docstring states the abstraction's purpose so the provider stays swappable:

```python
from abc import ABC, abstractmethod


class TranslationGatewayInterface(ABC):
    """Port for translating text between languages.

    Abstracted so the underlying provider (DeepL, an in-house model, etc.) can be swapped.
    """

    @abstractmethod
    async def translate(self, text: str, source_locale: str, target_locale: str) -> str: ...

    @abstractmethod
    async def translate_batch(
        self, texts: list[str], source_locale: str, target_locale: str
    ) -> list[str]: ...
```

Use a typed return when the gateway produces structured output — map the vendor
response to a **domain** type (e.g. a Pydantic model), never expose the vendor's type:

```python
from pydantic import BaseModel
from collections.abc import Sequence
from typing import TypeVar

T = TypeVar("T", bound=BaseModel)


class AIGatewayInterface(ABC):
    @abstractmethod
    async def complete(
        self,
        model: str,
        messages: Sequence[MessageParam],
        response_model: type[T],
        max_retries: int = 3,
    ) -> T: ...
```

## Adapter (infrastructure/gateways/)

Implements the port, wraps the vendor client, and receives the centralized
`Config` through its constructor (never call `os.getenv`). All methods are `async`. If the vendor SDK is
**synchronous**, bridge it to async with `run_in_executor` rather than blocking the event loop:

```python
import asyncio
import deepl

from app.config import Config
from app.domain.interfaces.translation_gateway import TranslationGatewayInterface


class DeepLTranslationGateway(TranslationGatewayInterface):
    def __init__(self, config: Config) -> None:
        self._client = deepl.DeepLClient(auth_key=config.deepl_api_key)  # secret via config

    async def translate(self, text: str, source_locale: str, target_locale: str) -> str:
        loop = asyncio.get_event_loop()
        # Sync SDK → run off the event loop so we don't block
        result = await loop.run_in_executor(
            None,
            lambda: self._client.translate_text(
                text, source_lang=source_locale.upper(), target_lang=target_locale.upper()
            ),
        )
        return result.text
```

For a **natively async** SDK, call it directly (no executor needed):

```python
import instructor
from anthropic import AsyncAnthropic

from app.domain.interfaces.ai_gateway import AIGatewayInterface, MessageParam, T


class AnthropicAIGateway(AIGatewayInterface):
    def __init__(self, api_key: str) -> None:
        self._client = instructor.from_anthropic(AsyncAnthropic(api_key=api_key))

    async def complete(self, model, messages, response_model: type[T], max_retries: int = 3) -> T:
        return await self._client.messages.create(
            model=model,
            messages=messages,
            response_model=response_model,  # maps the vendor reply to a domain Pydantic model
            max_retries=max_retries,
            max_tokens=4096,
        )
```

## DI wiring (providers/gateways.py)

Gateways **are** registered in Dishka. Use `Scope.APP` when the adapter is
stateless and reusable across requests:

```python
from dishka import Provider, Scope, provide


class GatewayProvider(Provider):
    translation_gateway = provide(
        DeepLTranslationGateway,
        provides=TranslationGatewayInterface,
        scope=Scope.APP,
    )
```

> ⚠️ Contrast with repositories: **gateways are wired in DI; repositories are NOT.**
> Repos are only constructible inside `UnitOfWork.__aenter__` (see [data-access.md](data-access.md)).

When configuration selects the provider, use a typed factory method:

```python
class GatewayProvider(Provider):
    @provide(scope=Scope.APP)
    def ai_gateway(self, config: Config) -> AIGatewayInterface:
        if config.ai_provider == "anthropic":
            return AnthropicAIGateway(api_key=config.anthropic_api_key)
        return OpenAIAIGateway(api_key=config.openai_api_key)
```

Keep provider construction synchronous so this provider can be used by both the
async HTTP/CLI container and the sync Celery container. The gateway's methods
remain async.

## Consumption

Domain services, external-only use cases, and workflows receive the gateway
**by its interface**, never the concrete. When a slow gateway call precedes a
database mutation, use a workflow plus an atomic persistence use case:

```python
# ✅ Correct — depends on the port
class TranslateCommentWorkflow:
    def __init__(
        self,
        translator: TranslationGatewayInterface,
        store_translation: StoreCommentTranslationUseCase,
    ):
        self.translator = translator
        self.store_translation = store_translation

    async def __call__(self, comment: CommentEntity, target_locale: str) -> str:
        translated = await self.translator.translate(comment.body, "en", target_locale)
        await self.store_translation(comment.id, target_locale, translated)
        return translated


class StoreCommentTranslationUseCase:
    def __init__(self, uow: UnitOfWorkInterface):
        self.uow = uow

    async def __call__(self, comment_id: UUID, target_locale: str, text: str) -> None:
        async with self.uow:
            await self.uow.translations.set_translation(
                "comment", comment_id, "body", target_locale, text
            )

# ❌ Wrong — concrete vendor adapter in the domain signature
class TranslateCommentWorkflow:
    def __init__(self, translator: DeepLTranslationGateway): ...
```

## Conventions

- **Vendor SDKs are imported only in gateway adapters.** If `import stripe` / `import anthropic` appears anywhere in `domain/`, that's a clean-architecture violation.
- **Map to domain types.** Convert vendor responses to entities / Pydantic models in the adapter; vendor types never cross into the domain.
- **Secrets via `Config`.** API keys, base URLs, and provider flags come from the centralized, application-scoped configuration object.
- **Retries & timeouts live in the adapter** (e.g. `max_retries`, client timeout config) — keep that concern out of use cases.
- **Gateways are stateless** → safe to register at `Scope.APP`. Don't store per-request state on them.
- **Gateway vs domain service:** a gateway is an *adapter to an external system*; a domain service holds *business logic* and may depend on a gateway (by its interface).
