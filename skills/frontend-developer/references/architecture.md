# Feature-Sliced Architecture

## Layer structure

```text
src/
├── shared/        # Generic UI, libraries, types; no business logic
├── entities/      # Domain objects and their presentation
├── features/      # Reusable user interactions
├── widgets/       # Composite blocks combining lower layers
├── pages/         # Screens composed from lower layers
└── api/           # Generated API code
```

Use this slice shape where applicable:

```text
<layer>/<slice>/
├── model/         # State, schemas, hooks, pure domain-facing logic
├── ui/            # Components owned by the slice
└── index.ts       # Public API
```

## Dependency rule

Import only downward:

```text
pages -> widgets -> features -> entities -> shared
```

- Never import upward.
- Avoid lateral imports between unrelated slices when a lower-level
  abstraction is the real shared dependency.
- Import other slices through their `index.ts`, not their internal file paths.
- Keep `shared` free of meal, account, planner, or other product-specific
  behavior.

## Choosing a layer

- Put a domain concept and its reusable presentation in `entities`.
- Put a reusable user action or interaction in `features`.
- Put a substantial composition of entities and features in `widgets`.
- Put screen composition, routing-facing state, and one-screen behavior in
  `pages`.
- Put project-agnostic UI and infrastructure adapters in `shared`.

Do not create a new layer or abstraction merely to avoid making a decision.
Choose the lowest layer that can own the code without importing upward.

## Page-local slices

A page may contain its own `features/` and `widgets/` directories. Apply the
same internal slice shape and dependency reasoning, but treat them as private
to that page.

Promote a page-local slice to a top-level `feature` or `widget` when another
page genuinely needs it. Do not pre-emptively generalize.

## Public APIs

Every reusable slice must have an `index.ts` that exports only supported
symbols. Keep implementation helpers private. When moving code between layers,
update consumers to use the new public API and check for forbidden deep
imports.
