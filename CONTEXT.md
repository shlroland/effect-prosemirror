# Effect ProseMirror

Effect ProseMirror combines ProseMirror's editor model with Effect-managed runtime boundaries. It exists to make editor lifecycle, dependencies, side effects, and integration flows explicit without replacing ProseMirror's document or transaction semantics.

## Language

**Effect-powered ProseMirror runtime**:
A runtime layer that uses Effect to manage ProseMirror editor lifecycle, dependencies, side effects, and integration boundaries while preserving ProseMirror's core document model.
_Avoid_: Effect ProseKit, ProseMirror replacement

**Command**:
A synchronous editing operation that immediately decides whether it can handle an editing intent and may immediately produce a ProseMirror transaction.
_Avoid_: Async command, effect command

**Command Surface**:
The Tag-driven API exposed by an Editing Core for synchronously running a Command or querying whether it can run or is active. Its accepted Tag union is inferred from that core's implemented Command Contributions, and each operation infers the selected Tag's complete argument tuple. It does not generate methods from public command names or accept arbitrary declared Tags.
_Avoid_: String command registry, generated named command methods

**Effectful Action**:
An asynchronous or Effect-managed operation that can use services and later submit a synchronous editing operation back into the editor runtime.
_Avoid_: Async command

**Action**:
A library-defined operation model for Effect-managed workflows that need services, asynchronous work, or custom runtime behavior outside ProseMirror's command contract.
_Avoid_: Command

**Action Surface**:
The type-safe API exposed by composed Extensions for invoking Effectful Actions separately from synchronous commands.
_Avoid_: Async command surface

**Reentry**:
The process where an Effectful Action returns to the current editor runtime and submits a synchronous editing operation based on the current editor state.
_Avoid_: Resume, commit, apply

**Tracked Target**:
An editing target held by an Effectful Action that can be mapped through document changes before Reentry.
_Avoid_: Saved position, stale selection

**Editor Scope**:
The Effect lifecycle boundary owned by a single Editing Core and inherited by its mounted Editor Instance. Resources and background work inside the Editor Scope end when the core is destroyed.
_Avoid_: App runtime, global editor runtime

**Editor Instance**:
The handle returned after an Editor Mount, exposing the ProseMirror view, typed command surface, action surface, and two explicit lifecycle operations: idempotent View-only `unmount()` and irreversible core-owning `destroy()`.
_Avoid_: Runtime, editor config

**Editing Core**:
The DOM-independent object that remains the sole owner of the schema and current ProseMirror `EditorState` before and after an Editor Instance is mounted. Every command and transaction path returns to the core; a mounted `EditorView` reflects the resulting state.
_Avoid_: Headless editor, Editor Instance, server-only editor

**Synchronous Core Surface**:
The invariant that an Editing Core exposes ProseMirror-oriented commands, state queries, and `transact` through their direct synchronous values even when the core is obtained from Effect Context. Effect manages construction, requirements, Scope, and future Actions; it does not wrap these operations in duplicate Effect-returning methods.
_Avoid_: runEffect, transactEffect, Effect Command

**Editor Mount**:
The operation that binds an Editing Core to one DOM element and creates the sole active `EditorView` owned by an Editor Instance. A core cannot have multiple active mounts.
_Avoid_: Attach view, initialize editor

**Editor Mount Failure**:
An `EditorMountError { cause }` raised when EditorView or plugin View initialization fails. Partial View resources and the active-mount reservation are released, while a caller-owned Editing Core remains live and may be mounted again.
_Avoid_: Partial mount, implicit borrowed-core destroy

**Owned Mount Rollback**:
The `createEditor` guarantee that a successfully created, internally owned Editing Core is synchronously invalidated if its subsequent Editor Mount fails, while the returned destroy Promise completes Scope finalizers asynchronously. The original `EditorMountError` remains primary and cleanup defects are observed by the Effect runtime.
_Avoid_: Leaked convenience Scope, waiting inside synchronous createEditor

**Single Active Mount**:
The lifecycle invariant that one Editing Core owns at most one active EditorView. A second concurrent `Editor.mount` fails with `EditorAlreadyMountedError` because focus, selection, composition, and View-dependent commands belong to one DOM view.
_Avoid_: Shared core across active views, multi-view editor

**Editor Unmount**:
The idempotent operation that destroys the active EditorView and detaches mounted state synchronization without destroying the Editing Core or its Editor Scope. A live core may be mounted again with its current state.
_Avoid_: Core destroy, editor reset

**Stale Editor Handle**:
An Editor Instance that has been unmounted. It remains permanently detached even if its Editing Core is mounted again; only idempotent `unmount()` and `destroy()` remain usable, while every state, View, command, or transaction operation fails with `EditorUnmountedError`.
_Avoid_: Handle rebinding, implicit core-only fallback

**Editor Destroy**:
The idempotent irreversible operation exposed by an Editing Core and every Editor Instance. It synchronously marks the core destroyed and unmounts the active View, then returns a shared `Promise<void>` that completes after all Editor Scope finalizers finish.
_Avoid_: View-only unmount, implicit ownership cleanup

**Mounted State Synchronization**:
The invariant that `core.state === editor.view.state`. DOM transactions return to the Editing Core through `dispatchTransaction`, and core state changes are projected back to the mounted View with `updateState`.
_Avoid_: Dual state ownership, independent View state

**View Synchronization Failure**:
The transition taken when an accepted core state cannot be projected through `EditorView.updateState`. The core retains its accepted state, the failing Editor Instance is automatically unmounted and permanently invalidated, and `EditorViewSynchronizationError` retains the original failure as `cause`.
_Avoid_: Core rollback, divergent mounted View

**Transaction Boundary**:
The short-lived synchronous, non-reentrant `transact` callback that receives the latest state, schema, and fresh transaction, and must explicitly return either a `Transaction` for ProseMirror `applyTransaction` or `false` for no write. It returns `true` only when the root transaction is accepted, including any resulting `appendTransaction` work; a `filterTransaction` rejection returns `false`. Queries remain available inside the callback, but nested `transact` or dispatching Command execution fails with `TransactionReentryError`. The first public API does not add a direct core/editor `dispatch(Transaction)` method.
_Avoid_: Retained transaction, nested write, duplicated dispatch API

**Transaction Execution Error**:
An Effect `TransactionExecutionError` that wraps an exception during a Transaction Boundary's callback or ProseMirror `applyTransaction` phase. It carries `phase: "callback" | "apply"` and the original value as `cause`; nested writes remain the separate `TransactionReentryError`.
_Avoid_: Raw transaction error, phase-specific transaction errors

**Initial Content**:
The ProseMirror Node, JSON document, or HTML string used to create the first state of an Editing Core.
_Avoid_: Default content, editor value

**Initial Content Error**:
An Effect error raised while constructing the first document: `InitialContentDocumentUnavailableError` when HTML has no global browser `document`; `InvalidInitialContentError` with `source: "Node" | "JSON" | "HTML"` when explicit content cannot form the schema document; or `InitialContentCreationError` when omitted content cannot be created by `topNodeType.createAndFill()`.
_Avoid_: Raw ProseMirror content error, generic initialization error

**Initial Content JSON Bridge**:
`InitialContent.JSON.fromNode(node)`, an explicit cross-schema Initial Content constructor that snapshots `node.toJSON()` and rebuilds it with the target core schema. Direct `InitialContent.Node(node)` instead requires the exact target Schema instance.
_Avoid_: Implicit Node conversion, silent schema replacement

**Initial Content Decoding Boundary**:
The boundary where callers may use Effect Schema to pre-decode unknown external input before passing `InitialContent.JSON`. Editing Core does not introduce a second generic Effect Schema decoder for NodeJSON; target-schema `Node.fromJSON` remains authoritative for ProseMirror document validity.
_Avoid_: Duplicate NodeJSON validation pipeline, InitialContent schema adapter

**Effect-backed Plugin**:
A normal ProseMirror plugin whose side effects, background work, and external dependencies are managed by Effect services inside the Editor Scope.
_Avoid_: Effect plugin, async plugin

**Service Requirement**:
An Extension Contribution that declares an Effect service needed by an extension without providing the business implementation.
_Avoid_: Embedded business layer, hidden dependency

**Extension**:
The primary authoring unit for composing editor capabilities as independent contributions such as node specs, mark specs, commands, plugins, and Effect-managed services.
_Avoid_: Runtime-only utility, low-level plugin wrapper, monolithic extension object

**Extension Contribution**:
A small composable editor capability that can be combined with other contributions to build an editor.
_Avoid_: Extension field, nested extension config

**Schema Contribution**:
An Extension Contribution that defines or augments ProseMirror schema elements such as node specs, mark specs, node attributes, or mark attributes.
_Avoid_: Schema override

**Forward Reference**:
A Schema Contribution that augments a node or mark declared elsewhere in the same Extension Union.
_Avoid_: Unresolved schema dependency

**Final Validation**:
The type-level and runtime check performed by `EditingCore.create`, `EditingCore.make`, and `EditingCore.layer` to ensure all composed Extension Contributions form a complete Editing Core. It collects every unresolved or conflicting contribution into aligned Typed Diagnostics and a runtime `FinalValidationError`. Partial Extensions and Extension Unions may retain Forward References.
_Avoid_: Eager extension validation

**Final Validation Error**:
An Effect `FinalValidationError` containing every Final Validation diagnostic discovered for an attempted Editing Core construction. Lower-level APIs may retain narrower errors, but complete-core construction does not fail fast on only the first unresolved contribution.
_Avoid_: First validation error, generic extension error

**Typed Diagnostic**:
A readable type-level error that explains which Extension Contributions are missing, incompatible, or incomplete.
_Avoid_: Bare never, opaque type failure

**Editor Error**:
An Effect `Data.TaggedError` emitted at a public editor boundary to describe a runtime failure without exposing a raw ProseMirror exception.
_Avoid_: Raw ProseMirror error, generic editor exception

**Command Not Available**:
A runtime configuration error raised as `CommandNotAvailableError` when JavaScript or unsafe TypeScript passes a Command Tag that the current Editing Core does not implement. It is distinct from a known Command returning `false` because it cannot handle the current state.
_Avoid_: Missing command returns false, unknown command lookup

**Command Execution Error**:
An Effect `CommandExecutionError` that wraps an exception raised while running or querying an available Command. It identifies the Command Tag's public name and the `run`, `canRun`, or `isActive` operation and retains the original exception only as `cause`.
_Avoid_: Raw command exception, operation-specific error classes

**Extension Union**:
The composition of multiple Extension Contributions into a single extension value.
_Avoid_: Extension all, extension merge

**Contribution Merge**:
The merge semantics defined by a specific Extension Contribution type when multiple contributions of that type are composed.
_Avoid_: Global duplicate rule

**Command Merge**:
The Contribution Merge that combines multiple implementations of one Command Tag into a synchronous chain ordered by descending priority and then Extension Union declaration order.
_Avoid_: Same-name structural merge, command overwrite, async command merge

**Static Keymap**:
An Extension Contribution that maps key chords to typed Command Surface invocations and can be validated without handling keyboard events.
_Avoid_: Dynamic keymap, keyboard listener

**Keymap Merge**:
The Contribution Merge that combines single-invocation bindings for the same Key Chord into a short-circuiting chain ordered by descending priority and then Extension Union declaration order. A binding returning `false` passes handling to the next binding; the first `true` consumes the key.
_Avoid_: Duplicate-key rejection, last binding wins

**Key**:
A closed, typed logical keyboard key used by a Key Chord, aligned with `KeyboardEvent.key` and ProseMirror key-name semantics rather than a physical keyboard position. Standard named keys use explicit members, while character values are validated as single printable Unicode characters.
_Avoid_: Raw key string, arbitrary named key, KeyboardEvent.code, physical key position

**Character Key Decoding**:
The pair of character constructors where `Key.Character(value)` is the synchronous convenience API that throws `InvalidKeyError`, and `Key.decodeCharacter(value)` returns an Effect with the same tagged error in its error channel.
_Avoid_: Unvalidated dynamic character, raw string key

**Key Modifier**:
A canonical member of the unordered modifier set on a Key Chord: `Mod`, `Ctrl`, `Alt`, `Shift`, or `Meta`. Modifier order and duplicates do not affect chord identity.
_Avoid_: Cmd alias, Control alias, ordered modifier list

**Keymap Compilation**:
The future Editor View adapter operation that preserves the ordered Static Keymap binding chains while delegating platform-specific `Mod` resolution, key normalization, and keyboard event matching to `prosemirror-keymap`.
_Avoid_: Custom platform detection, reimplemented ProseMirror key matching

**Command Invocation**:
An immutable Command Tag together with the complete argument tuple captured when a Static Keymap is constructed. Runtime-computed arguments are passed directly through the Command Surface instead.
_Avoid_: String command lookup, dynamic command callback, deferred argument factory

**Key Binding**:
A single mapping from one Key Chord to one Command Invocation. Fallback sequences are expressed by composing multiple bindings for the same chord through Keymap Merge.
_Avoid_: Invocation list, keymap sequence

**Command Tag**:
A nominal, composable command contract, separate from its implementations, that carries a Command's unique public name and user-facing parameter tuple. Command Invocations depend on the Tag for immediate argument checking, while Command Definitions provide implementations and Final Validation verifies that the Extension Union contains one. Implementations merge only when they reuse the same Tag; distinct Tags with the same public name are invalid.
_Avoid_: Command name string, untyped registry key

**Command Definition**:
A synchronous implementation of a Command Tag, including its required `run` creator and optional `isActive` creator. Multiple Definitions for the same Tag participate in Command Merge.
_Avoid_: Command contract, Command name

**Command Execution Context**:
The standard ProseMirror `(state, dispatch, view?)` inputs supplied to a Command. Editing Core execution omits the optional View; a mounted Editor Command Surface and `prosemirror-keymap` supply the real `EditorView` without changing the Command Definition.
_Avoid_: Fake EditorView, DOM reference stored by Editing Core
