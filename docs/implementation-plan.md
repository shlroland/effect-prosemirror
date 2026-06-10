# Implementation Plan

## Phase 1: Project scaffold

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

Implement the core Extension value without ProseMirror integration.

Deliverables:

- `Extension` interface compatible with Effect `Pipeable`
- `ExtensionImpl` using Effect's `pipeArguments`
- `Extension.union(...extensions)`
- `Extension.priority(Priority.High)`
- `Priority` const object
- contribution storage with priority metadata

Validation:

- runtime tests for union and priority propagation
- type tests for tuple-preserving varargs union

## Phase 3: Schema contributions

Implement schema contribution APIs and merge behavior.

Deliverables:

- `Extension.NodeSpec`
- `Extension.NodeAttr`
- `Extension.MarkSpec`
- `Extension.MarkAttr`
- raw type model for specs and attrs
- Forward Reference support
- ProseKit-style schema merge behavior
- Typed Diagnostics for Final Validation failures

Validation:

- type tests for node and mark inference
- type tests for missing attr targets at editor finalization
- runtime tests for same-name spec merge
- runtime tests for attr merge and parse/serialize wrapping

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
