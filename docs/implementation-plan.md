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
- `Schema.collect(extension)` for same-name node and mark spec merge (complete)
- Forward Reference support (complete for attr contributions targeting specs declared later in the union)
- ProseKit-style schema merge behavior (partially complete for same-name specs and attr contribution merge)
- Typed Diagnostics for Final Validation failures

Validation:

- type tests for node and mark inference
- runtime tests for same-name spec merge (complete)
- runtime tests for priority-based same-name spec merge (complete)
- runtime tests for attr merge and missing-target diagnostics (complete)
- type tests for missing attr targets at editor finalization
- runtime tests for attr merge and parse/serialize wrapping

Next slice:

- Promote missing-target diagnostics into Final Validation errors before Editor integration.
- Add attr parse/serialize wrapping for `toDOM` and `parseDOM`.
- Add type-level diagnostics for missing attr targets at editor finalization.

## Phase 4: Commands and keymaps

Implement typed synchronous command contributions.

Deliverables:

- `Command.define({ run, isActive? })`
- `Extension.Commands`
- typed Command Surface
- same-name command chain merge
- `canExec` derived from dry-run command execution
- `isActive` with matching `run` parameters
- `Extension.Keymap`
- static keymap bindings to command references

Validation:

- type tests for command surface inference
- type tests for incompatible same-name command merge
- type tests for keymap command references and arguments
- runtime tests for command chain order
- runtime tests for `canExec` and `isActive`

## Phase 5: Editor layer

Integrate with ProseMirror and Effect services.

Deliverables:

- `EditorService`
- `Editor.layer(options)`
- lower-level `Editor.make` if needed
- `createEditor(options)`
- `editor.view`
- `editor.state` getter
- `editor.schema` getter
- Effect-native `editor.transact`
- convenience `editor.transact`
- idempotent `destroy(): void` for `createEditor`
- `Data.TaggedError` runtime errors
- service requirement propagation from extensions

Validation:

- runtime tests for editor creation
- runtime tests for transaction submission
- runtime tests for destroy semantics
- type tests for service requirements
- runtime tests for missing services and validation errors

## Phase 6: Minimal built-in extensions

Add the smallest useful built-in extension set.

Deliverables:

- `Doc.make()`
- `Text.make()`
- `Paragraph.make()`
- `BaseCommands.make()`
- `Basic.make()`

Validation:

- smoke test creating an editor with `Basic.make()`
- smoke test inserting text through command surface or `transact`
- type tests proving `Basic.make()` produces expected nodes and commands
