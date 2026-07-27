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

**Action**:
A discrete, Editor Scope-managed editing intent that spans asynchronous time, may use Effect services, and can later Reenter the latest document state.
_Avoid_: Effectful Action, Async Command, generic Effect

**Action Surface**:
The Tag-driven interface that exposes the Actions available from a composed Extension as lazy Effects with typed arguments, success values, and failures.
_Avoid_: Async command surface

**Action Execution**:
A running instance of an Action that begins when its lazy Effect is executed. It survives Editor Unmount and is interrupted by either its caller or destruction of the owning Editing Core.
_Avoid_: Action value, background command, detached task

**Reentry**:
The atomic process where an Action resolves a Tracked Target against the latest Editing Core state and submits a synchronous editing operation.
_Avoid_: Resume, commit, stale transaction

**Tracked Target**:
An opaque editing target owned by an Action Execution and mapped through accepted document changes until Reentry or Action completion.
_Avoid_: Saved position, stale selection

**Tracked Target Change**:
The state where a Tracked Target still resolves but its original content was touched while the Action was running. The Action decides whether that change is a conflict.
_Avoid_: Target loss, automatic conflict

**Tracked Target Loss**:
The state where a Tracked Target can no longer identify the intended document content, so Reentry cannot edit it.
_Avoid_: Target change, mapped deletion

**Editor Scope**:
The Effect lifecycle boundary owned by a single Editing Core and inherited by its mounted Editor Instance. Resources and Action Executions inside the Editor Scope end when the core is destroyed, not when a View is unmounted.
_Avoid_: App runtime, global editor runtime

**Editor Instance**:
The handle returned after an Editor Mount, exposing the ProseMirror view, typed command surface, action surface, and two explicit lifecycle operations: idempotent View-only `unmount()` and irreversible core-owning `destroy()`.
_Avoid_: Runtime, editor config

**Editing Core**:
The DOM-independent object that remains the sole owner of the schema and current ProseMirror `EditorState` before and after an Editor Instance is mounted. Every command and transaction path returns to the core; a mounted `EditorView` reflects the resulting state.
_Avoid_: Headless editor, Editor Instance, server-only editor

**Synchronous Core Surface**:
The invariant that an Editing Core exposes ProseMirror-oriented commands, state queries, and `transact` through direct synchronous values, while Actions remain separate lazy Effects. Effect manages construction, requirements, and Scope without wrapping synchronous operations in duplicate Effect-returning methods.
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
The idempotent operation that destroys the active EditorView and detaches mounted state synchronization without destroying the Editing Core or its Editor Scope. A live core may be mounted again with its current state. A View destruction exception becomes `EditorUnmountError { cause }` after detachment.
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

**State Plugin Contribution**:
An `Extension.Plugin(plugin)` contribution that installs one normal ProseMirror State Plugin in the Editing Core. Its state field, transaction filter, and append behavior run through the Core-owned EditorState; its Plugin View is owned by a mounted EditorView.
_Avoid_: Plugin wrapper, Core plugin surface, View-only plugin

**Effect-backed Plugin**:
A future normal ProseMirror plugin whose side effects, background work, and external dependencies are managed by Effect services inside the Editor Scope. It is distinct from the initial State Plugin Contribution because it needs a scoped asynchronous lifecycle.
_Avoid_: Effect plugin, async plugin

**Service Requirement**:
An Extension Contribution that declares an Effect service needed by an extension without providing the business implementation. Effect-native construction requires it in the environment; synchronous construction receives a Layer that provides it for the Editor Scope.
_Avoid_: Embedded business layer, hidden dependency

**Synchronous Service Layer**:
A no-input Layer supplied to `EditingCore.create` or `createEditor` that provides every Service Requirement and shares the Editor Scope. A Layer that fails or requires asynchronous acquisition is reported as `ServiceLayerCreationError` because synchronous construction cannot await it.
_Avoid_: Unscoped service, hidden async initialization

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
The mounted Editor View adapter operation that preserves the ordered Static Keymap binding chains while delegating platform-specific `Mod` resolution, key normalization, and keyboard event matching to `prosemirror-keymap`. It is a View-owned direct plugin and does not enter the Editing Core's state plugin collection.
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

**Base Command**:
One of the minimal synchronous editing intents provided by `BaseCommands.make()`: inserting text, deleting a non-empty selection, selecting the complete document, or splitting the current paragraph. Base Commands are schema-aware ProseMirror operations and do not carry key bindings, history, or asynchronous behavior.
_Avoid_: Editor action, key binding, async command

**Paragraph Split**:
The Base Command that splits the current paragraph only when the selection is an empty TextSelection and ProseMirror confirms the document can split at that position. A non-empty selection or unsplittable position returns `false`.
_Avoid_: Split selected content, forced split, generic block split

**Command Execution Context**:
The standard ProseMirror `(state, dispatch, view?)` inputs supplied to a Command. Editing Core execution omits the optional View; a mounted Editor Command Surface and `prosemirror-keymap` supply the real `EditorView` without changing the Command Definition.
_Avoid_: Fake EditorView, DOM reference stored by Editing Core
