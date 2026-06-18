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

Implements the port, wraps the vendor client, and reads secrets from the `config`
singleton (never `os.getenv`). All methods are `async`. If the vendor SDK is
**synchronous**, bridge it to async with `run_in_executor` rather than blocking the event loop:

```python
import asyncio
import deepl

from app.config import config
from app.domain.interfaces.translation_gateway import TranslationGatewayInterface


class DeepLTranslationGateway(TranslationGatewayInterface):
    def __init__(self) -> None:
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

## DI wiring (di.py)

Gateways **are** registered in DI — typically as `Singleton`, since the client is
stateless and reusable across requests:

```python
DI[TranslationGatewayInterface] = Singleton(DeepLTranslationGateway)
```

> ⚠️ Contrast with repositories: **gateways are wired in DI; repositories are NOT.**
> Repos are only constructible inside `UnitOfWork.__aenter__` (see [data-access.md](data-access.md)).

When the provider is chosen at runtime, wire a small factory that reads `config`:

```python
def _make_ai_gateway() -> AIGatewayInterface:
    if config.ai_provider == "anthropic":
        return AnthropicAIGateway(api_key=config.anthropic_api_key)
    return OpenAIAIGateway(api_key=config.openai_api_key)

DI[AIGatewayInterface] = Singleton(_make_ai_gateway)
```

## Consumption

Domain services and use cases receive the gateway **by its interface**, never the concrete:

```python
# ✅ Correct — depends on the port
class TranslateCommentUseCase:
    def __init__(self, uow: UnitOfWorkInterface, translator: TranslationGatewayInterface):
        self.uow = uow
        self.translator = translator

    async def __call__(self, comment: CommentEntity, target_locale: str) -> str:
        translated = await self.translator.translate(comment.body, "en", target_locale)
        async with self.uow:
            await self.uow.translations.set_translation(
                "comment", comment.id, "body", target_locale, translated
            )
        return translated

# ❌ Wrong — concrete vendor adapter in the domain signature
class TranslateCommentUseCase:
    def __init__(self, translator: DeepLTranslationGateway): ...
```

## Conventions

- **Vendor SDKs are imported only in gateway adapters.** If `import stripe` / `import anthropic` appears anywhere in `domain/`, that's a clean-architecture violation.
- **Map to domain types.** Convert vendor responses to entities / Pydantic models in the adapter; vendor types never cross into the domain.
- **Secrets via `config`.** API keys, base URLs, and provider flags come from the `config` singleton.
- **Retries & timeouts live in the adapter** (e.g. `max_retries`, client timeout config) — keep that concern out of use cases.
- **Gateways are stateless** → safe to register as `Singleton`. Don't store per-request state on them.
- **Gateway vs domain service:** a gateway is an *adapter to an external system*; a domain service holds *business logic* and may depend on a gateway (by its interface).
