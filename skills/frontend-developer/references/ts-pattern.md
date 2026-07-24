# ts-pattern

Use `ts-pattern` when branching on discriminated unions, nested state, multiple
fields, or query/tool states benefits from type narrowing and exhaustiveness.
Keep a simple `if` for a single obvious predicate.

Upstream reference: [ts-pattern documentation](https://github.com/gvergnaud/ts-pattern#documentation).

## Core pattern

```tsx
import { match, P } from 'ts-pattern';

return match(state)
  .with({ status: 'pending' }, () => <Loading />)
  .with({ status: 'error' }, ({ error }) => <ErrorState error={error} />)
  .with({ status: 'success' }, ({ data }) => <Content data={data} />)
  .exhaustive();
```

Prefer `.exhaustive()` for a closed, trusted union. It makes newly added union
members a compile-time failure. Use `.otherwise()` when input is deliberately
open or runtime data may contain unsupported variants; make the fallback
intentional.

## Patterns used in the reference project

- Match React Query state through reusable structural patterns.
- Match chat/tool parts on their discriminant before validating payloads.
- Use `P.union(...)` when several literal states share behavior.
- Use `P.string`, `P.array()`, `P.instanceOf(...)`, `P.not(...)`, and
  `P.nullish` for structural narrowing.
- Use nested `match` expressions when an already narrowed branch contains a
  second independent union.

## Reusable query patterns

Centralize repeated structural matchers:

```ts
export const PQuery = {
  error: { isError: true },
  loading: { isLoading: true },
  success: { data: P.not(P.nullish) },
} as const;
```

Order overlapping patterns from most specific to least specific. Remember that
React Query flags can overlap during background refetches; choose patterns based
on the UI behavior required, not on their names alone.

## Zod-backed runtime patterns

Static narrowing does not validate unknown runtime payloads. Bridge a Zod
schema into `P.when`:

```ts
export const PSchema = <S extends z.ZodType>(schema: S) =>
  P.when((value: unknown): value is z.output<S> =>
    schema.safeParse(value).success
  );
```

First match a cheap discriminant such as `type` and `state`, then validate only
the payload for that branch:

```ts
match(part)
  .with(
    {
      type: 'tool-generate_meal',
      state: 'output-available',
      output: PSchema(generateMealResultSchema),
    },
    ({ output }) => <MealCard meal={output.meal} />
  )
  .with({ type: 'tool-generate_meal' }, () => null)
  .otherwise(() => null);
```

Do not use `P.when` to hide an ordinary condition that is clearer in a handler.
Do not assume a TypeScript pattern validates data that crossed an untrusted
runtime boundary.
