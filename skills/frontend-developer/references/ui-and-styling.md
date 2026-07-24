# UI and Styling

## NativeWind first

Use NativeWind `className` for static layout, spacing, typography, colors, and
responsive variants. Use `cn()` for conditional class composition.

```tsx
<View className="flex-1 bg-background px-4 pt-6">
  <Text variant="h3">...</Text>
</View>

<View
  className={cn(
    'rounded-xl p-4',
    isActive ? 'bg-primary' : 'bg-muted'
  )}
/>
```

Do not use template strings to assemble conditional classes. Avoid
`StyleSheet.create` and inline objects when a class expresses the same thing.
Use a `style` prop only for values that must be computed at runtime, such as an
animated interpolation or measured pixels; keep the static portion in
`className`.

## Logical direction

Use logical utilities so layouts work in both LTR and RTL:

| Avoid | Use |
| --- | --- |
| `pl-*`, `pr-*` | `ps-*`, `pe-*` |
| `ml-*`, `mr-*` | `ms-*`, `me-*` |
| `left-*`, `right-*` | `start-*`, `end-*` |
| `border-l-*`, `border-r-*` | `border-s-*`, `border-e-*` |
| `rounded-l-*`, `rounded-r-*` | `rounded-s-*`, `rounded-e-*` |
| `text-left`, `text-right` | `text-start`, `text-end` |

## Primitives

Inspect the shared UI barrel before creating a component. Prefer the
project's react-native-reusables/shadcn-derived accessible primitives for
buttons, text, inputs, cards, dialogs, selects, switches, tabs, and tooltips.
In the reference project these live under `@/shared/ui`.

Create a shared custom component only when it adds a reusable semantic or
behavioral contract. Keep feature-specific composition inside the owning
feature.

## Text variants

Prefer the shared `Text` component's variants over recreating their typography:

`h1`, `h2`, `h3`, `h4`, `lead`, `large`, `small`, `muted`, `p`, `default`.

```tsx
<Text variant="muted">...</Text>
<Text variant="h3">...</Text>
<Text variant="small" className="text-center">...</Text>
```

Use `className` only for spacing, positioning, color state, or a deliberate
override that no variant represents.

## Accessibility and platform behavior

- Preserve the semantics and focus behavior of shared primitives.
- Give icon-only press targets accessible labels and adequate hit areas.
- Check keyboard avoidance, safe areas, dynamic text, loading states, and RTL.
- Use Expo/React Native platform APIs before introducing native wrappers.
