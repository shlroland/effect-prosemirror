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

Status: complete.

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

Status: complete.

Deliverables:

- `Doc.make()` (complete)
- `Text.make()` (complete)
- `Paragraph.make()` (complete)
- `BaseCommands.make()` (complete: InsertText, DeleteSelection, SelectAll, and SplitParagraph)
- `Basic.make()` (complete)

Validation:

- smoke test creating an editor with `Basic.make()` (complete)
- smoke test inserting text through command surface or `transact` (complete through command surface)
- type tests proving `Basic.make()` produces expected nodes and commands (complete)

## Phase 7: Scoped Actions and tracked Reentry

Add discrete asynchronous editing intents without weakening ProseMirror's synchronous transaction model.

Status: complete.

Deliverables:

- `Action.Tag(name)<Self, Args, Success, Failure>()`
- `Action.define(tag, run)` with inferred Effect requirements
- variadic `Extension.Actions(...definitions)`
- Tag-driven `actions.run` returning a lazy Effect
- Editor Scope-managed Action Executions with caller and core-destroy interruption
- opaque Tracked Selection capture with immutable snapshot data
- mapping through every accepted root and appended transaction
- atomic Reentry against the latest Editing Core state
- explicit Tracked Target Change and Tracked Target Loss behavior
- retained Action service Context inside the Editing Core
- Final Validation for duplicate Action definitions and names

Validation:

- type tests for Action arguments, success, failure, and inferred requirements
- runtime tests for lazy execution and unavailable Action Tags
- runtime tests for mapping before and outside a tracked selection
- runtime tests for target change and target loss
- runtime tests for atomic Reentry against the latest state
- runtime tests for unmount survival and destroy interruption
- runtime tests for caller interruption and Action finalizers

## Phase 8: ProseMirror Plugin Contributions

Add the smallest Plugin contribution without introducing a second plugin protocol.

Status: complete.

The public seam is `Extension.Plugin(plugin)`, where `plugin` is a normal
`prosemirror-state` `Plugin`. The Editing Core compiles contributed plugins in
descending Extension priority and then declaration order, supplies that list to
`EditorState.create`, and continues to own every transaction application. This
means plugin state, `filterTransaction`, and `appendTransaction` work both
headlessly and while mounted; ProseMirror owns Plugin View creation, update, and
destruction through the mounted `EditorView`.

Effect-backed plugins are deliberately deferred. They need a separate scoped
lifecycle and asynchronous failure model, so adding them to this small static
contribution would make its interface shallow and ambiguous.

Deliverables:

- `Extension.Plugin(plugin)` contribution for one normal ProseMirror Plugin
- priority-ordered plugin compilation into the initial Editor State
- `PluginConfigurationError` for invalid plugin sets, including duplicate
  ProseMirror keyed plugins
- documentation that `PluginKey` remains the normal way to read plugin state
- a minimal append-transaction fixture to validate Action target mapping through
  appended transactions

Validation:

- runtime tests for plugin state initialization and transaction application in
  an unmounted Editing Core
- runtime tests for `filterTransaction` rejection and `appendTransaction`
  application
- jsdom tests for Plugin View mount, update, unmount, and remount lifecycle
- runtime test for invalid keyed-plugin configuration
- Action regression test whose Tracked Selection maps through an appended
  transaction

## Phase 9: Opt-in History Extension

Status: complete.

Provide the first useful built-in consumer of State Plugin Contributions without
changing the minimal `Basic.make()` contract.

Deliverables:

- `History.make(options?)` wrapping the native `prosemirror-history` Plugin
- synchronous `History.Undo` and `History.Redo` Commands
- public extension-path and root exports
- an options interface for `depth` and `newGroupDelay`

Validation:

- runtime test for undo/redo through the Core Command Surface
- type test for the opt-in History options and zero-argument Commands

## Phase 10: Basic Inline Marks and Test Core

Status: complete.

Add the first inline formatting extensions and standardize their test setup on a
small, Core-native fixture inspired by ProseKit's tagged document workflow.

Deliverables:

- opt-in `Strong.make()` with `Toggle` and `Mod-B`
- opt-in `Emphasis.make()` with `Toggle` and `Mod-I`
- a test-only `createTestCore` helper using `<a>` / `<b>` selection tags
- root and extension-path exports for both mark extensions

Validation:

- runtime tests for mark toggling through the Core Command Surface
- runtime tests for Static Keymap contributions
- type tests for zero-argument Toggle Commands

## Phase 11: Markdown Mark Input Rules

Status: complete.

Add View-owned Markdown input behavior while retaining normal native Plugin
semantics and a compact ProseKit-style test call site.

Deliverables:

- a test-only `createTestEditor(...).inputText(...)` fixture
- `Extension.InputRules(...rules)` with tuple preservation and priority merge
- an internal Mark Input Rule adapter that resolves a Mark from current state
- `**text**` to Strong and `*text*` to Emphasis rules
- native `prosemirror-inputrules` dependency

Validation:

- jsdom runtime tests that type each delimiter pattern through the mounted View
- runtime and type tests for merged Input Rules contributions
- existing Command and Static Keymap tests remain green for both mark extensions

## Phase 12: Native NodeView Adapters

Status: complete.

Add a framework-neutral, View-owned NodeView contribution without moving DOM
ownership into Editing Core or introducing a second plugin protocol.

Deliverables:

- `Extension.NodeView({ node, create })` for native ProseMirror NodeView factories
- a `NodeView` Context exposing ProseMirror's node, view, `getPos`, decorations,
  and inner decorations
- one adapter per node name, resolved by priority and declaration order
- typed and runtime Final Validation for missing target nodes
- registry installation through `Editor.mount`'s `EditorView` direct `nodeViews`
  prop

Validation:

- runtime test for custom DOM creation at the mounted Editor seam
- runtime tests for Core-driven `update`, declined-update replacement, and
  NodeView-originated transactions returning through the Core
- runtime tests for destruction, remount recreation, priority selection, and
  mount-failure recovery
- type test for NodeView target Final Validation

## Phase 13: Core Subscription

Status: complete.

Add a synchronous listener registration on Editing Core so framework adapters
can observe accepted state changes without owning, transforming, or dispatching
Core state.

Deliverables:

- `core.subscribe(listener)` returning an unsubscribe function
- notification after every accepted state change, including selection-only,
  View-originated, and appended transactions
- no notification for rejected transactions, including `filterTransaction`
- notification after an accepted state even when View synchronization fails
- `EditorDestroyedError` for subscription after destroy
- `TransactionReentryError` when a listener dispatches during notification

Validation:

- runtime tests for accepted, rejected, selection-only, unsubscribe, append,
  destroy, and nested-dispatch behavior
- jsdom tests for View-originated dispatch and failed View synchronization
- type test for the subscribe and unsubscribe function signatures

## Phase 14: React adapter mount

Status: complete.

Publish `@effect-prosemirror/react` as a workspace package that mounts a
caller-owned Editing Core through React without taking Core or Scope ownership.

Deliverables:

- `EditorProvider` receiving an existing Core
- `EditorContent` as the sole Editor View mount path
- `useEditor()` returning the mounted Editor Instance or `undefined`
- React unmount destroying only the View

Validation:

- jsdom tests for Basic editing, View-only unmount, remount, and Strict Mode
- type test for the public React entry point

## Phase 15: React Core state observation

Status: complete.

Expose Core-owned state to React through Core Subscription without duplicating
document ownership. `useEditorState(selector)` works independently of the View
lifecycle. Commands, Actions, and transactions remain on the existing Core and
Editor surfaces.

Deliverables:

- `useEditorState(selector)` subscribed through `core.subscribe`
- rerender on accepted document and selection-only changes
- rerender on View-originated transactions
- subscription teardown on React unmount

Validation:

- jsdom tests for Core transact, selection-only, View dispatch, and unmount
- type test for selector inference

## Phase 16: React atomic NodeView

Status: complete.

A third-party extension can render an atomic node with React while ProseMirror
owns the outer NodeView DOM. Each native NodeView instance creates one React
root on a dedicated `reactDOM` element, rerenders that root on `update`, and
synchronously unmounts it in `destroy`.

Deliverables:

- `ReactNodeView.atom({ node, component })` returning a native NodeView Adapter
- attribute updates rerender the existing root
- React events dispatch through the Core-owned View transaction path
- React root unmount runs exactly once per NodeView destroy

Validation:

- jsdom tests for render, attribute update, Core-bound click, and destroy/remount
- type test for adapter node-name inference and Final Validation
