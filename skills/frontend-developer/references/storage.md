# Typed Namespaced Storage

Use a small application-owned storage port over the platform engine. Features,
atoms, and stores depend on this port or a domain adapter; only the
implementation module imports AsyncStorage, MMKV, Keychain, SecureStore, or
another engine.

## Core contract

```ts
export interface Storage {
  clear(): Promise<void>;
  getItem<T>(key: string, defaultValue?: T): Promise<T | undefined>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  removeItem(key: string): Promise<void>;
  setItem<T>(key: string, value: T): Promise<void>;
}
```

Keep the contract asynchronous even when a particular engine is synchronous.
This prevents storage-engine details leaking into consumers.

## Namespaces and versions

Build physical keys as:

```text
{namespace}:{key}
{namespace}@{version}:{key}
```

`keys()` returns logical keys with the prefix removed. `clear()` removes only
keys in that exact namespace/version, never all application storage.

Use a dedicated namespace for independently owned state such as a global store.
A version change creates a new namespace; it does not migrate or delete old
data. Add an explicit migration/cleanup step when old data matters.

## Serialization

Inject `serialize` and `deserialize` functions, defaulting to the project's JSON
helpers:

```ts
interface SerializationOptions {
  serialize?: (value: unknown) => string;
  deserialize?: <T>(raw?: string) => T | undefined;
}
```

- Serialize in exactly one layer.
- Treat engine `null` as a missing value at the boundary.
- Define corrupt-data behavior deliberately: propagate, report and remove, or
  return a default.
- Be aware that `parsed ?? defaultValue` treats a stored `null` as absent.
- Do not claim JSON round-trips `Date`, `Map`, `Set`, `undefined`, or class
  instances unless custom serialization supports them.

## Domain adapters

Hide key names and storage operations behind a narrow adapter:

```ts
export interface TokenStorage {
  getAccessToken(): Promise<string | undefined>;
  setAccessToken(token: string): Promise<void>;
  removeAccessToken(): Promise<void>;
}

export const tokenStorage: TokenStorage = {
  getAccessToken: () => storage.getItem('accessToken'),
  setAccessToken: (token) => storage.setItem('accessToken', token),
  removeAccessToken: () => storage.removeItem('accessToken'),
};
```

This makes consumers independent of physical keys and enables a secure engine
or test double without rewriting features.

## Jotai integration

Adapt the port to `atomWithStorage` and enable initial hydration when the UI
must wait for persisted state:

```ts
atomWithStorage<State | undefined>(
  'logicalKey',
  undefined,
  {
    getItem: () => storage.getItem<State>('logicalKey'),
    setItem: (_key, value) => storage.setItem('logicalKey', value),
    removeItem: () => storage.removeItem('logicalKey'),
  },
  { getOnInit: true }
);
```

Model the hydration/loading state separately when `undefined` is also a valid
domain value.

## Zustand integration

Zustand `PersistStorage.getItem` returns `null` for a missing value, while the
application port returns `undefined`. Adapt at the boundary:

```ts
const persistStorage: PersistStorage<Partial<RootStore>> = {
  getItem: (name) =>
    rootStorage.getItem<StorageValue<Partial<RootStore>>>(name)
      .then((value) => value ?? null),
  setItem: (name, value) => rootStorage.setItem(name, value),
  removeItem: (name) => rootStorage.removeItem(name),
};
```

Use `partialize` to persist only durable fields. Never persist actions,
ephemeral UI state, query caches, or derived data by default.

## Security and lifecycle

AsyncStorage is unencrypted. Put credentials, refresh tokens, and other secrets
behind the same domain adapter but back that adapter with Keychain/SecureStore
or the project's approved secure engine. The abstraction pattern does not make
an insecure engine secure.

- Clear relevant namespaces or adapters during logout/account removal.
- Avoid logging raw stored values or physical keys containing sensitive data.
- Test namespace isolation, missing/default behavior, serialization failures,
  adapter key mapping, hydration, partial persistence, and migrations.
