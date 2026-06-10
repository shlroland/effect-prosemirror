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
The type-safe API exposed by composed Extensions for invoking synchronous editor commands.
_Avoid_: String command registry

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
The Effect lifecycle boundary owned by a single editor instance. Resources and background work inside the Editor Scope end when the editor is destroyed.
_Avoid_: App runtime, global editor runtime

**Editor Instance**:
The handle returned after an editor is created, exposing the ProseMirror view, typed command surface, action surface, and lifecycle operations.
_Avoid_: Runtime, editor config

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
The type-level and runtime check performed when creating an Editor Instance to ensure all composed Extension Contributions form a complete editor.
_Avoid_: Eager extension validation

**Typed Diagnostic**:
A readable type-level error that explains which Extension Contributions are missing, incompatible, or incomplete.
_Avoid_: Bare never, opaque type failure

**Extension Union**:
The composition of multiple Extension Contributions into a single extension value.
_Avoid_: Extension all, extension merge

**Contribution Merge**:
The merge semantics defined by a specific Extension Contribution type when multiple contributions of that type are composed.
_Avoid_: Global duplicate rule

**Command Merge**:
The Contribution Merge for commands where same-named commands with compatible parameters are combined into a synchronous chain.
_Avoid_: Command overwrite, async command merge
