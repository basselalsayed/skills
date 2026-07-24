# API, Forms, and Internationalisation

## Generated API

Treat `src/api/` generated files as read-only. Never edit `*.gen.ts`.

Use hey-api's generated TanStack Query options with the corresponding React
Query hook:

```tsx
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getMealOptions,
  loginMutation,
} from '@/api/@tanstack/react-query.gen';
import type { MealEntity } from '@/api/types.gen';

const meal = useQuery(getMealOptions({ path: { meal_id: id } }));
const login = useMutation({
  ...loginMutation(),
  onSuccess: (data) => {
    // feature-owned effect
  },
});
```

- Inspect the generated operation before guessing path, query, or body keys.
- Use generated types instead of duplicating DTO interfaces.
- Keep cache invalidation and feature effects near the owning feature.
- Do not write `fetch` or `axios` calls for an endpoint represented by the
  generated client.
- Fix a contract through the OpenAPI source and regenerate rather than patching
  generated output.

## Forms

Use `react-hook-form` with a Zod resolver. Put a reusable form schema in the
slice's `model/`; a small single-use schema may remain next to the form.

- Infer form types from the schema.
- Translate validation messages when constructing the schema.
- Keep mutation orchestration in the feature model or form boundary, not in
  generic controls.
- Reuse shared form controls so error, label, focus, and accessibility behavior
  stays consistent.

## Internationalisation

Translate every user-facing string with `react-i18next`: headings, labels,
placeholders, buttons, empty states, errors, accessibility labels, toasts, and
Zod messages.

Namespace keys by FSD layer and slice:

```text
{layer}.{slice}.{group}.{key}

features.auth.validation.email
features.auth.login.button
pages.profile.loadError
```

Add the key to the source translation file in the same change. Reuse an
existing key only when its meaning, not merely its current English text, is the
same.

```tsx
const schema = (t: TFunction) =>
  z.object({
    email: z.string().email(t('features.auth.validation.email')),
  });
```

Do not hardcode fallback English inside a component as a substitute for adding
a translation key.
