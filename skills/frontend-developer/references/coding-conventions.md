# Coding Conventions

## Reuse before writing

Before adding a hook or inline lifecycle mechanism:

1. Search the project for an existing domain hook.
2. Check installed hook libraries such as `usehooks-ts` and `react-use`.
3. Use the library hook when its behavior and React Native support fit.
4. Write a custom hook only for domain-specific behavior or a missing contract.

Do not hand-roll timers, debounce, previous-value tracking, or toggles when an
installed library already handles the lifecycle correctly.

## File naming

Follow the target repository first. The reference convention is:

| Kind | Pattern |
| --- | --- |
| Component | `*.component.tsx` |
| Page | `*.page.tsx` |
| Hook | `use-*.hook.ts` or `use-*.ts` |
| Pure function | `*.function.ts` |
| Type | `*.type.ts` |
| Entity or constant | `*.entity.ts` |

Use kebab-case names. Do not rename existing files solely to enforce the
convention unless the task includes that migration.

## TypeScript and React

- Model state with discriminated unions where states are mutually exclusive.
- Derive types from Zod schemas and generated API types.
- Keep pure transformations outside render bodies.
- Memoize only when it stabilizes a dependency, avoids meaningful work, or is
  required by a downstream API.
- Avoid effects for values that can be derived during render.
- Keep page components compositional; extract reusable interaction into a
  feature and reusable domain presentation into an entity.

## Commands and verification

Use `pnpm` for frontend package and workspace commands. Inspect the package
scripts rather than inventing command names.

For a normal change, run the narrowest relevant tests plus formatting, linting,
and TypeScript checks. Regenerate the API only when the source contract changed;
review generated diffs rather than editing them.
