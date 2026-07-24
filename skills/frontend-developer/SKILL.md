---
name: frontend-developer
description: "Build and review React Native and Expo mobile frontends using Feature-Sliced Design, NativeWind, shared accessible primitives, generated hey-api TanStack Query clients, react-hook-form with Zod, react-i18next, ts-pattern, es-toolkit, and typed namespaced storage. Use for mobile screens, components, feature slices, query and mutation states, forms, styling, client-side persistence, TypeScript branching, utility-library migration, and frontend refactors in apps/mobile or similarly structured projects."
---

# Frontend Developer

Implement React Native frontend changes by extending the target project's
established patterns. Inspect neighboring slices and package versions before
coding; use the references below for the concern being changed.

## Workflow

1. Read repository instructions and the closest existing implementation.
2. Classify each new module by FSD layer before creating files.
3. Identify existing shared UI, hooks, generated API operations, validation
   schemas, translations, storage adapters, and utilities to reuse.
4. Read every relevant reference from the index below.
5. Implement through the slice's public API. Do not bypass a lower layer or
   import a slice's internals from elsewhere.
6. Add translations and tests with the change.
7. Run the repository's frontend format, lint, typecheck, and focused tests
   with `pnpm`.

## Non-negotiable rules

1. Preserve the dependency direction
   `pages -> widgets -> features -> entities -> shared`. Never import upward.
2. Keep business behavior out of `shared`; promote page-local code only when a
   second page needs it.
3. Give each slice a barrel `index.ts` that exposes its deliberate public API.
4. Prefer NativeWind `className`, logical directional utilities, and existing
   accessible primitives over bespoke styling and controls.
5. Never edit generated `*.gen.ts` files or hand-write HTTP calls for generated
   backend operations.
6. Translate every user-visible string, including validation and error copy.
7. Prefer exhaustive typed state modelling over scattered boolean conditionals.
8. Prefer platform APIs and `es-toolkit`; do not add or extend Lodash usage.
9. Persist through the project's typed storage abstraction, never by calling
   the storage engine directly from features or UI.
10. Follow local conventions when they are stricter or newer than this skill.

## Reference index

Read the relevant file before implementing:

| Concern | Reference |
| --- | --- |
| FSD layers, import direction, page-local slices, barrels | [references/architecture.md](references/architecture.md) |
| NativeWind, logical properties, primitives, text variants | [references/ui-and-styling.md](references/ui-and-styling.md) |
| Generated API usage, forms, Zod, i18n | [references/api-forms-i18n.md](references/api-forms-i18n.md) |
| Hooks, naming, implementation and validation conventions | [references/coding-conventions.md](references/coding-conventions.md) |
| Typed branching, query states, Zod-backed patterns | [references/ts-pattern.md](references/ts-pattern.md) |
| Replacing Lodash and choosing modern utilities | [references/es-toolkit.md](references/es-toolkit.md) |
| Namespaced storage, serialization, adapters, Jotai and Zustand integration | [references/storage.md](references/storage.md) |
