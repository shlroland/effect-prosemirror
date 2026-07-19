# Editing Core Before View Adapter

The first executable Editing Core will own schema creation, current `EditorState`, synchronous commands, and transactions without creating an `EditorView`. `EditingCore.create`, `EditingCore.make`, and `EditingCore.layer` construct this object. An Editor Instance is created only by `Editor.mount`, which binds the core to an `EditorView`; `createEditor` remains the convenience constructor for that mounted result. This keeps command behavior testable in the Node runtime and prevents DOM lifecycle concerns from shaping the command model.

An Editing Core obtained from Effect Context and one returned by the synchronous convenience constructor expose the same direct ProseMirror-oriented values. Commands, queries, and `transact` remain synchronous boolean operations; Effect manages construction, dependencies, Scope, and future Actions rather than adding duplicate Effect-returning operation methods.

Command Definitions retain ProseMirror's standard optional `view` parameter. Editing Core execution omits it; after mounting, the Editor Instance and ProseMirror keymap execution provide the real `EditorView`. The core does not emulate DOM-dependent command behavior.

The Editing Core remains the sole `EditorState` owner after mounting. `EditorView.dispatchTransaction` routes DOM transactions back into the core, and accepted core changes update the View with `updateState`, maintaining `core.state === editor.view.state`. Commands, Keymaps, explicit transactions, and DOM input cannot advance independent state copies.

If `EditorView.updateState` throws after the core accepts a transaction, the core retains its new state rather than attempting an unsafe rollback across plugin state or external effects. The adapter automatically destroys and detaches the failing View, permanently invalidates that Editor Instance, and raises `EditorViewSynchronizationError { cause }`. The live core remains remountable.

One Editing Core can own at most one active EditorView. A concurrent second `Editor.mount` fails with `EditorAlreadyMountedError`; focus, selection, DOM composition, and View-dependent commands are scoped to the sole active View.

View or plugin View initialization failures during `Editor.mount` are wrapped in `EditorMountError { cause }`. The adapter cleans partial View resources and releases the active-mount reservation, but does not destroy the caller-owned core, which remains live and available for a later mount attempt.

The `createEditor` convenience constructor owns the core it creates. If its subsequent mount fails, it calls `core.destroy()` before rethrowing the original `EditorMountError`. Core invalidation and View cleanup happen synchronously; asynchronous Scope finalizers continue through the destroy Promise and cleanup defects are observed by the Effect runtime rather than replacing the mount root cause.

Unmounting is distinct from destroying the core. `editor.unmount()` idempotently destroys the active View and detaches synchronization while preserving the core's state and Editor Scope, so the live core may be mounted again. `core.destroy()` synchronously invalidates the core, automatically unmounts any active View, permanently rejects future mounts, and returns a shared `Promise<void>` that completes after all Editor Scope finalizers finish.

Every Editor Instance exposes both lifecycle operations regardless of whether it came from `Editor.mount` or `createEditor`. `editor.destroy()` delegates to the same irreversible transition as `core.destroy()`; construction origin does not implicitly change cleanup semantics.

An unmounted Editor Instance is a permanently stale handle. Remounting its live core creates a new Editor Instance and never retargets the old one. Only the old handle's idempotent lifecycle methods remain usable; View, state, schema, command, and transaction access fails with `EditorUnmountedError` rather than operating on the core or a later View implicitly.

The initial public Editing Core and Editor Instance APIs expose synchronous `transact` and the Command Surface, but do not add a direct `dispatch(Transaction)` method. Internal command and View dispatch still converge on the core-owned state path. Advanced mounted users retain the original `editor.view.dispatch`, and the adapter routes it back through that path.

`transact` is a synchronous, non-reentrant public write boundary. Read-only command queries remain valid inside its callback, while nested `transact` or dispatching Command execution fails with `TransactionReentryError`. ProseMirror's plugin and `appendTransaction` work within a single internal state application remains part of that application rather than public reentry.

Its callback return type is exactly `Transaction | false`. A Transaction always enters the full ProseMirror application path, including selection-only and metadata-only transactions; `false` is the only no-write result. Nullish, boolean `true`, and asynchronous results are not accepted.

The core applies a returned Transaction with `EditorState.applyTransaction`. `transact` returns `true` only when the root transaction passes `filterTransaction`, at which point the core adopts the final state including all `appendTransaction` work. A filtered root transaction leaves state unchanged and returns `false`.
