# Localisation (MANDATORY for any entity with user-visible text)

The backend has a full i18n/l10n system. All new features with user-visible content MUST be localised.

## Architecture overview

- **Canonical content** is stored in English on entity models (`tweets.text`, `tags.name`, etc.)
- **Translations** are stored in the `content_translations` EAV table (`entity_type`, `entity_id`, `field_name`, `language_code`, `value`)
- **Language resolution** is done by `LocaleMiddleware` → `request.state.locale` (priority: `x-locale` header → `Accept-Language` → `"en"`)
- **User preference** overrides request locale via `user.preferred_language_code`

## Locale injection in routers

Always inject `UserLocale` (not `Locale`) in endpoints returning user-visible entities:

```python
from app.routers.dependencies import UserLocale

@router.get("/{id}", response_model=CommentEntity, operation_id="getComment")
async def get_comment(
    id: str,
    user: AuthenticatedUser,
    locale: UserLocale,  # ✅ respects user preference
    use_case: GetCommentUseCase = FASTAPI_DI.depends(GetCommentUseCase),
    i18n: I18nServiceInterface = FASTAPI_DI.depends(I18nServiceInterface),
):
    result = await use_case(id, locale)
    if not result:
        http_exc.not_found(i18n, locale, "errors.comment_not_found")
    return result
```

## Fetching and applying translations in use cases

Use `uow.translations` for content, then `TranslationOverlayService` to apply — never do inline string replacement:

```python
class GetCommentUseCase:
    def __init__(self, uow: UnitOfWorkInterface, overlay: TranslationOverlayService):
        self.uow = uow
        self.overlay = overlay

    async def __call__(self, id: str, language_code: str) -> CommentEntity | None:
        async with self.uow:
            entity = await self.uow.comments.get(id)
            if not entity:
                return None
            trans = await self.uow.translations.get_translations("comment", id, language_code)
        return self.overlay.overlay_comment(entity, trans)
```

- Use `get_translations_batch` when loading lists to avoid N+1 queries
- `TranslationOverlayService` falls back to English if no translation exists — never raises

## Writing translations

Use `uow.translations.set_translation` (upserts via `ON CONFLICT`):

```python
await self.uow.translations.set_translation("comment", entity.id, "body", language_code, translated_body)
```

## UI strings (error messages, labels)

Never hardcode English strings in routers. Always use `I18nService`:

```python
# ✅ Correct
i18n.t("errors.comment_not_found", locale)

# ❌ Wrong
raise HTTPException(detail="Comment not found")
```

Add new keys to all locale JSON files under `app/i18n/locales/`.

## Seeding translations

Add seed data for new entity types in your seeds module, following the existing sample-translation pattern.

## Tests

- Set `preferred_language_code` on user fixtures when testing localised endpoints
- Assert translated field values are returned (not the English canonical value) when a non-`"en"` locale is used
