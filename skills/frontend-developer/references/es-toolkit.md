# es-toolkit and Lodash Replacement

Prefer native JavaScript for a clear one-liner. Otherwise import the modern
implementation from `es-toolkit` (or its documented category entrypoint). Use
`es-toolkit/compat` only as a temporary migration bridge when exact Lodash edge
semantics are required.

Upstream references: [es-toolkit documentation](https://es-toolkit.dev/) and
[Lodash compatibility layer](https://es-toolkit.dev/compatibility.html).

## Migration workflow

1. Find every Lodash import and its call site.
2. Identify mutation, nullish-input, iteratee, argument-order, and return-value
   semantics in that call site.
3. Replace it with a native API or modern `es-toolkit` function.
4. Change one utility family at a time and run its focused tests.
5. Remove `lodash`, `lodash-es`, and their type packages only after the workspace
   scan is clean.

Do not mechanically change only the module specifier: the modern API is not
always signature-compatible with Lodash.

## Reference-project migration map

| Current use | Preferred replacement | Note |
| --- | --- | --- |
| `noop` | `noop` from `es-toolkit` | Direct replacement |
| `take(array, n)` | `take` from `es-toolkit` | Direct for normal non-negative counts |
| `cloneDeep(value)` | `cloneDeep` from `es-toolkit` | Direct modern implementation |
| `camelCase`, `snakeCase`, `startCase` | same names from `es-toolkit` | Inputs are already typed as strings |
| `flow([a, b])` | `flow(a, b)` from `es-toolkit` | Modern `flow` takes functions as arguments, not a Lodash-style array |
| `defaults(options, defaults)` | destructuring or an explicit merge | Preserve the difference between absent, `undefined`, and `null` |
| `transform(...)` | `reduce`, `Object.entries`, or a purpose-built recursive function | Prefer readable native traversal |
| `isObject(value)` | an explicit predicate | Decide whether functions and arrays should count |

Category imports such as `es-toolkit/array` and `es-toolkit/string` are valid
when they match the installed version and bundler. Follow the target project's
chosen import style consistently.

## Semantic traps

### Defaults

Lodash `defaults` fills missing and `undefined` fields but preserves `null`.
Object spread does not fill an explicitly `undefined` field:

```ts
const {
  pageSize = defaultOptions.pageSize,
  initialPageParam = defaultOptions.initialPageParam,
  ...rest
} = options ?? {};
```

Use destructuring defaults when that is the intended behavior. Use
`{ ...defaults, ...options }` only when an explicit `undefined` should win.

### Flow

```ts
import { flow } from 'es-toolkit';

const transformResponse = flow(nullToUndefined, mapKeysToCamel);
```

Use `es-toolkit/fp` only for intentionally data-last pipelines; do not mix its
curried signatures with the ordinary package API accidentally.

### Object checks

State the desired domain:

```ts
const isNonNullObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null;
```

This excludes functions but includes arrays, maps, sets, and dates. Add explicit
array/date/plain-object checks where the traversal requires them. Use
`es-toolkit/compat` only if the Lodash definition—including functions—is
actually required.

### Recursive transforms

Prefer a named recursive function with explicit branches for arrays, plain
objects, `Date`, `Map`, and `Set`. Preserve or deliberately change whether the
original is mutated, whether symbols/inherited keys are traversed, and how
cycles are handled. Add characterization tests before replacing `transform` or
`cloneDeep` in such code.
