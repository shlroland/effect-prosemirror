# Implementation Plan

## Phase 1: Project scaffold

Status: complete.

Create the package and test infrastructure.

Deliverables:

- `package.json`
- TypeScript config
- Vitest config
- `expect-type` setup
- package exports for root and core module paths
- initial source and test directories

Validation:

- `pnpm typecheck`
- `pnpm test`

## Phase 2: Pipeable Extension core

Status: complete.

Implement the core Extension value without ProseMirror integration.

Deliverables:

- `Extension` interface compatible with Effect `Pipeable`
- `ExtensionImpl` using Effect's `pipeArguments`
- `Extension.union(...extensions)`
- pipeable `Extension.union(...extensions)` operator form
- `Extension.priority(Priority.High)`
- `Priority` const object
- contribution storage with priority metadata

Validation:

- runtime tests for union and priority propagation
- type tests for tuple-preserving varargs union
- runtime and type tests for pipeable union preserving contribution order and tuple shape

## Phase 3: Schema contributions

Implement schema contribution APIs and merge behavior.

Status: in progress.

Deliverables:

- `Extension.NodeSpec` (complete)
- `Extension.NodeAttr` (complete)
- `Extension.MarkSpec` (complete)
- `Extension.MarkAttr` (complete)
- raw type model for specs and attrs (complete)
- `EditorSchema.collect(extension)` for same-name node and mark spec merge (complete)
- `EditorSchema.create(extension)` for creating a real ProseMirror schema (complete)
- Effect Schema attr validation sugar compiled to ProseMirror `AttributeSpec.validate` (complete)
- Forward Reference support (complete for attr contributions targeting specs declared later in the union)
- ProseKit-style schema merge behavior (complete for same-name specs, attr contribution merge, and attr parse/serialize wrapping)
- Typed Diagnostics for missing node and mark attr targets at Final Validation (complete)

Validation:

- type tests for node and mark inference
- runtime tests for same-name spec merge (complete)
- runtime tests for priority-based same-name spec merge (complete)
- runtime tests for attr merge and missing-target diagnostics (complete)
- runtime tests for ProseMirror schema creation and schema creation errors (complete)
- runtime tests for Effect Schema and native ProseMirror attr validation (complete)
- type tests for missing attr targets at editor finalization (complete)
- runtime tests for attr merge and parse/serialize wrapping (complete)

## Phase 4: Commands and keymaps

Implement typed synchronous command contributions.

Status: complete. Static Keymaps are validated at the Core boundary and installed by the mounted Editor View.

Deliverables:

- Effect-style `Command.Tag(name)<Self, Args>()` contract (complete)
- `Command.define(tag, { run, isActive? })` (complete)
- variadic `Extension.Commands(...definitions)` (complete)
- Tag-driven typed `run`, `canRun`, and `isActive` Command Surface (complete)
- priority-ordered Command Merge by shared Tag identity (complete)
- `canRun` derived from dry-run command execution (complete)
- `isActive` constrained by the Tag argument tuple (complete)
- structured `Key`, `KeyChord`, and `CommandInvocation` values (complete)
- `Extension.Keymap(...bindings)` and Static Keymap Merge (complete)
- Final Validation for missing keymap Command implementations (complete)
- `prosemirror-keymap` View direct-plugin installation (complete)

Validation:

- type tests for Command Tag arguments and available core commands (complete)
- type tests for keymap command references and arguments (complete)
- runtime tests for command chain order (complete)
- runtime tests for `canRun` and `isActive` (complete)
- runtime tests for KeyChord normalization and Keymap Merge (complete)
- jsdom runtime tests for key dispatch, priority chains, false fallthrough, and unmount cleanup (complete)

## Phase 5: Editing Core and Editor mount

Integrate with ProseMirror and Effect services.

Status: complete. The executable Editing Core, `Editor.mount` lifecycle, `createEditor` convenience constructor, and Extension service requirement propagation are complete.

Deliverables:

- `EditingCore` Context service contract (complete)
- scoped `EditingCore.make(options)` (complete)
- `EditingCore.layer(options)` (complete)
- convenience `EditingCore.create(options)` (complete)
- `Editor.mount(core, element)` (complete)
- `createEditor(options)` (complete)
- `editor.view` (complete)
- core `state` and `schema` getters (complete)
- synchronous `core.transact` boundary (complete)
- immediately invalidating, idempotent `destroy(): Promise<void>` with asynchronous Scope finalization (complete)
- `Data.TaggedError` runtime errors (complete for Editing Core and mount lifecycle)
- Static Keymap View adapter (complete)
- `Extension.Require` service requirement propagation to Effect environments (complete)
- synchronous `layer` provisioning within the Editor Scope (complete)

Validation:

- runtime tests for Editing Core creation (complete)
- runtime tests for transaction submission (complete)
- runtime tests for destroy semantics (complete)
- jsdom runtime tests for View/Core synchronization and mount lifecycle (complete)
- type tests for service requirements (complete)
- runtime tests for missing services and synchronous Layer provisioning (complete)

## Phase 6: Minimal built-in extensions

Add the smallest useful built-in extension set.

Status: in progress. The structural Basic extension is complete; built-in commands remain.

Deliverables:

- `Doc.make()` (complete)
- `Text.make()` (complete)
- `Paragraph.make()` (complete)
- `BaseCommands.make()`
- `Basic.make()` (complete for the structural schema slice)

Validation:

- smoke test creating an editor with `Basic.make()` (complete)
- smoke test inserting text through command surface or `transact` (complete through `transact`)
- type tests proving `Basic.make()` produces expected nodes and commands
