# Effect ProseMirror Design Draft

## Goal

Effect ProseMirror combines ProseMirror's editor model with Effect-managed runtime boundaries. It keeps ProseMirror schema, state, transaction, plugin, and command semantics intact while using Effect for lifecycle, dependency, resource, and asynchronous workflow management.

## Non-goals

- Do not replace ProseMirror's document or transaction model.
- Do not make ProseMirror commands asynchronous.
- Do not implement UI framework adapters in the first phase.
- Do not embed arbitrary business Layers inside extensions in the first phase.
- Do not design the full Action or Plugin APIs before the core extension model is stable.

## MVP API

```ts
Extension.union(...extensions)

Extension.NodeSpec(options)
Extension.NodeAttr(options)

Extension.MarkSpec(options)
Extension.MarkAttr(options)

Command.Tag(name)<Self, Args>()
Command.define(tag, implementation)
Extension.Commands(...definitions)
Extension.Keymap(...bindings)

Extension.Require(serviceTag)

EditingCore.make(options)
EditingCore.layer(options)
EditingCore.create(options)
Editor.mount(core, element)
createEditor(options)
```

Deferred APIs:

```ts
Extension.Actions(...)
Extension.Plugin(...)
Extension.Layer(...)
Extension.DynamicKeymap(...)
```

## Module Structure

The repository can use internal packages for separation, while the public API is exposed through path exports from the aggregate `effect-prosemirror` package.

Core imports:

```ts
import { EditingCore, Editor, Extension, Command, Priority, createEditor } from "effect-prosemirror"
import { EditingCore, Editor, Extension, Command } from "effect-prosemirror/core"
```

The first phase should provide core exports. Extension and framework paths can be added as they are implemented.

Built-in extensions should use module-level `make` functions rather than `defineXx` names:

```ts
import * as Doc from "effect-prosemirror/extensions/doc"
import * as Text from "effect-prosemirror/extensions/text"
import * as Paragraph from "effect-prosemirror/extensions/paragraph"
import * as Basic from "effect-prosemirror/extensions/basic"

const extension = Extension.union(Doc.make(), Text.make(), Paragraph.make())

const basic = Basic.make()
```

The first built-in extensions should be minimal and exist to validate the core model: `Doc.make()`, `Text.make()`, `Paragraph.make()`, and `Basic.make()`.

`Basic.make()` follows a minimal-usable principle:

```ts
Basic.make() = Extension.union(Doc.make(), Text.make(), Paragraph.make())
```

`BaseCommands.make()` is composed into `Basic.make()`. It contributes four schema-aware synchronous Commands: `InsertText(text)`, `DeleteSelection()`, `SelectAll()`, and `SplitParagraph()`. `SplitParagraph()` accepts only an empty TextSelection at a ProseMirror-splittable position; it does not delete or split a selected range. Neither slice includes history, keymaps, marks, lists, tables, drop cursor, or gap cursor.

## Extension Contributions

An Extension is a typed collection of independent Extension Contributions. Contributions are composed with `Extension.union`.

Extensions are pipeable and should implement Effect's public `Pipeable` shape so modifiers compose in Effect style:

```ts
Extension.NodeSpec({
  name: "paragraph",
  content: "inline*",
}).pipe(
  Extension.union(
    Extension.NodeAttr({
      type: "paragraph",
      attr: "textAlign",
      spec: { default: null },
    }),
  ),
  Extension.priority(Priority.High),
)
```

The implementation should import or conform to Effect's public `Pipeable` API, not a private internal path.

Runtime `.pipe(...)` should use Effect's public pipe helper rather than a hand-written reducer:

```ts
import { pipeArguments, type Pipeable } from "effect/Pipeable"

class ExtensionImpl<Spec> implements Extension<Spec> {
  readonly _tag = "Extension"

  pipe() {
    return pipeArguments(this, arguments)
  }
}
```

`Extension.union` does not apply a single global duplicate-key rule. Each contribution type defines its own Contribution Merge semantics.

`Extension.union` accepts varargs only. Array-based composition is deferred because widened arrays lose tuple information that is needed for precise type-safe merging.

`Extension.union` is both a root composition function and a pipeable composition operator:

```ts
const root = Extension.union(Doc.make(), Text.make(), Paragraph.make())

const paragraph = Paragraph.make().pipe(Extension.union(BaseParagraphCommands.make()))
```

The pipeable form prepends the receiver to the union, so `a.pipe(Extension.union(b, c))` has the same contribution order and tuple shape as `Extension.union(a, b, c)`.

Extensions support priority as a pipeable modifier:

```ts
Extension.union(
  Extension.MarkSpec({ name: "bold" }),
  Extension.Commands(Command.define(ToggleBold, { run })),
).pipe(Extension.priority(Priority.High))
```

`Extension.priority(...)` applies to the entire extension subtree it receives. Applying it to a single contribution affects only that contribution; applying it to an `Extension.union(...)` affects all contributions inside that union.

Priority uses a const object rather than a TypeScript enum:

```ts
export const Priority = {
  Highest: "highest",
  High: "high",
  Default: "default",
  Low: "low",
  Lowest: "lowest",
} as const

export type Priority = (typeof Priority)[keyof typeof Priority]
```

The default priority is `Priority.Default`.

Priority affects schema contributions only for same-name merge precedence. Higher-priority `NodeSpec`, `MarkSpec`, `NodeAttr`, and `MarkAttr` contributions override lower-priority fields when the same schema element is merged.

The first phase should not treat final ProseMirror `OrderedMap` node or mark ordering as a public priority contract. Ordering should be stable, but only same-name schema merge precedence is part of the public API.

Schema contributions follow the ProseKit style:

```ts
Extension.NodeSpec({
  name: "paragraph",
  content: "inline*",
  group: "block",
})

Extension.NodeAttr({
  type: "paragraph",
  attr: "textAlign",
  default: "left",
  schema: EffectSchema.Literal("left", "center", "right"),
})

Extension.MarkSpec({
  name: "bold",
  parseDOM: [{ tag: "strong" }],
  toDOM: () => ["strong", 0],
})

Extension.MarkAttr({
  type: "link",
  attr: "href",
  spec: { default: null, validate: "string|null" },
})
```

`NodeAttr` and `MarkAttr` may use Forward References. A partial extension can declare an attribute for a node or mark that is declared elsewhere in the final Extension Union.

Attribute contributions support two shapes. The low-level shape accepts a ProseMirror `AttributeSpec` directly:

```ts
Extension.NodeAttr({
  type: "paragraph",
  attr: "textAlign",
  spec: { default: null, validate: "string|null" },
})
```

Both shapes can define DOM parsing and serialization for the added attribute. `parseDOM` reads the attribute value from a matched element. `toDOM` returns a DOM attribute name/value pair, or `null` to omit it:

```ts
Extension.NodeAttr({
  type: "paragraph",
  attr: "textAlign",
  default: "left",
  parseDOM: (element) => element.getAttribute("data-align"),
  toDOM: (value) => (value ? ["data-align", String(value)] : null),
})
```

During schema collection, attribute parsing wraps existing tag parse rules and preserves their `attrs`, `getAttrs`, and `false` rejection behavior. Attribute serialization wraps the target spec's existing `toDOM` function and merges the returned pair into its top-level DOM attributes. Style parse rules are not passed to attribute `parseDOM` because their parser input is a CSS value rather than an `HTMLElement`.

The high-level shape accepts `default`, ProseMirror-compatible `validate`, or an Effect Schema value. To avoid confusing it with `EditorSchema` or ProseMirror's `Schema`, import Effect's schema module as `EffectSchema`:

```ts
import * as EffectSchema from "effect/Schema"

Extension.NodeAttr({
  type: "paragraph",
  attr: "textAlign",
  default: "left",
  schema: EffectSchema.Literal("left", "center", "right"),
})
```

Effect Schema validation is compiled to ProseMirror's synchronous `AttributeSpec.validate` hook, so only schemas with no Effect context are supported at this layer.

Schema merge should follow ProseKit's behavior:

- same-named `NodeSpec` and `MarkSpec` contributions are merged instead of rejected
- `attrs` are merged by attribute name
- `parseDOM` arrays are appended
- ordinary object fields are merged with later or higher-priority contributions taking precedence
- `NodeAttr` and `MarkAttr` augment an existing node or mark contribution during Final Validation
- attribute contributions can wrap `toDOM` and `parseDOM` behavior so added attributes participate in serialization and parsing
- missing node or mark targets are Final Validation errors, not errors at `NodeAttr` / `MarkAttr` creation time

The current schema merge entry point is `EditorSchema.collect(extension)`. It collects schema contributions from an Extension and returns merged node and mark spec records. At this stage it handles same-name `NodeSpec` and `MarkSpec` merging, including priority order, `attrs` merging, and `parseDOM` append behavior.

`EditorSchema.create(extension)` builds the real ProseMirror schema from collected contributions. Missing attr targets are reported as `MissingSchemaTargetsError`; invalid ProseMirror schema definitions are wrapped in `InvalidEditorSchemaError`. Attribute parse/serialize wrapping is applied during collection. Type-level Final Validation diagnostics remain a separate follow-up step.

Schema compilation is memoized by immutable Extension object identity. Reusing the same Extension value returns the same ProseMirror Schema instance across Editing Cores, which makes strict `InitialContent.Node(node)` usable without weakening its Schema identity check. Structurally similar but independently composed Extensions still produce distinct Schema instances and use `InitialContent.JSON.fromNode` for explicit conversion.

## Commands

Commands are synchronous ProseMirror editing operations. A command creator receives user-facing arguments and returns a synchronous ProseMirror command.

```ts
export class ToggleBold extends Command.Tag("toggleBold")<ToggleBold, []>() {}
export class SetTextColor extends Command.Tag("setTextColor")<
  SetTextColor,
  [options: { readonly color: string }]
>() {}

Extension.Commands(
  Command.define(ToggleBold, {
    run: () => (state, dispatch, view) => {
      return true
    },
  }),

  Command.define(SetTextColor, {
    run: (options: { color: string }) => (state, dispatch) => {
      return true
    },
    isActive: (options) => (state) => {
      return false
    },
  }),
)
```

A Command Tag is a public contract containing the command name and user-facing parameter tuple. It is independent of any concrete implementation, so Keymaps and other consumers can depend on the Tag without importing an implementation. `Command.define(tag, options)` provides one implementation of that contract. `Extension.Commands` contributes one or more definitions.

`run` is a creator whose user-facing parameters produce a ProseMirror `Command`; optional `isActive` uses those same user-facing parameters and produces a synchronous `(state) => boolean` query. The Tag constrains both creators to its parameter tuple.

The composed editor exposes a typed Command Surface:

```ts
core.commands.run(ToggleBold)
core.commands.run(SetTextColor, { color: "red" })
```

The Command Surface is driven by Command Tags and does not generate methods from their public string names. `run` executes against the current editor state and returns `boolean`; it does not return a ProseMirror command function.

The surface is parameterized by the union of Command Tags implemented by the Editing Core's finalized Extension. Passing a declared Tag that the core does not implement is a compile-time error. Declaring a Tag does not make it globally executable; it enters a core's surface only through at least one contributed Command Definition.

At runtime, JavaScript or unsafe TypeScript may still pass an unavailable Tag. The surface raises an Effect `CommandNotAvailableError` containing the public command name rather than returning `false`. `false` is reserved for a known command chain that cannot handle the current state. A destroyed Editing Core remains the previously defined lifecycle exception: its Command Surface operations return `false` without attempting lookup or execution.

If an available Command Definition or the ProseMirror Command it creates throws, the surface wraps the exception in one Effect `CommandExecutionError` shape containing the public command name, `operation: "run" | "canRun" | "isActive"`, and the original value as `cause`. The synchronous success path remains `boolean`; no raw extension or ProseMirror exception crosses the public boundary.

The surface also exposes synchronous state queries through the same Tag contract:

```ts
core.commands.canRun(ToggleBold)
core.commands.isActive(ToggleBold)
core.commands.canRun(SetTextColor, { color: "red" })
core.commands.isActive(SetTextColor, { color: "red" })
```

`canRun` is derived by running the command without dispatch. `isActive` is also synchronous and reads the current editor state. The first phase should support `isActive` on `Command.define`, while keeping it optional.

Command Definitions retain ProseMirror's original `(state, dispatch?, view?) => boolean` command signature. `EditingCore.commands` supplies the current state and dispatch but leaves the optional `view` argument `undefined`. Mounted `Editor.commands` and installed `prosemirror-keymap` bindings supply the real `EditorView`. A view-dependent command may therefore return `false` when invoked on an unmounted Editing Core and succeed when invoked through a mounted Editor Instance. The core never creates, stores, or fakes an `EditorView` to change this behavior.

When `isActive` is provided, its user-facing parameters must match the Command Tag. If `isActive` is omitted, the command surface still exposes `.isActive(...)`, which returns `false`.

Multiple definitions of one Command Tag merge into a synchronous chain: definitions are tried in priority order until one returns `true`. Runtime Tag identity is nominal, so implementations must reuse the same exported Tag to participate in the merge. Two distinct runtime Tags with the same public name fail Final Validation with a `DuplicateCommandName` diagnostic even when their parameter tuples are equal.

For multiple definitions of the same Command Tag, state queries use `some` semantics. `canRun` is true if any merged definition can execute. `isActive` is true if any merged definition reports active.

`Command.define(tag, { run })` is required instead of accepting arbitrary functions. This associates the implementation with its public contract, keeps synchronous return types explicit, and leaves room for future command metadata or state queries without changing the API shape. It supersedes the earlier named-record form.

`run` should not receive Effect services or an editor-specific context. Command follows ProseMirror's existing synchronous command concept, so service-dependent or asynchronous workflows belong to the future Action API.

## Keymaps

The first phase supports static keymaps that reference the Command Surface.

Key chords are structured values rather than public ProseMirror key-name strings:

```ts
const chord = KeyChord.make({
  modifiers: [Modifier.Mod],
  key: Key.Character("b"),
})
```

`Key` is a closed tagged union of logical keyboard values, for example `Key.Character("b")`, `Key.Digit(1)`, `Key.Enter`, `Key.ArrowUp`, and `Key.Function(5)`. Standard named keys are explicit API members. `Key.Character(value)` is the synchronous convenience constructor and throws Effect `InvalidKeyError` for invalid dynamic input; `Key.decodeCharacter(value)` returns an Effect with that same tagged error in its error channel. There is no public `Key.Raw(string)` or `Key.Named(string)` escape hatch; missing standard keys are added explicitly to the union. It aligns with `KeyboardEvent.key` and ProseMirror's logical key-name semantics. Physical `KeyboardEvent.code` bindings such as `"KeyB"` are outside the public API so bindings respect the active keyboard layout.

Key modifiers form an unordered set containing only `Modifier.Mod`, `Modifier.Ctrl`, `Modifier.Alt`, `Modifier.Shift`, and `Modifier.Meta`. `KeyChord.make` normalizes them into a stable order and removes duplicates, so `[Modifier.Mod, Modifier.Alt]` and `[Modifier.Alt, Modifier.Mod]` have the same chord identity. Aliases such as `Cmd` and `Control` are not part of the public model.

`Mod` remains platform-abstract in the Static Keymap and Editing Core. `Editor.mount` compiles each chord's ordered binding chain into one `prosemirror-keymap` command and installs the resulting plugin as a View direct plugin. The adapter does not implement its own platform detection or key-event matching: `prosemirror-keymap` resolves `Mod`, shifted characters, normalized key names, and keyboard events. If abstract chords overlap on a particular platform, normal ProseMirror keymap precedence and `false` fallthrough determine which binding handles the event. Destroying the View removes this direct plugin with the rest of the View lifecycle.

A Command Invocation captures an immutable, complete argument tuple when the Static Keymap is constructed:

```ts
const level: HeadingLevel = 1
const invocation = CommandInvocation.make(SetHeading, { level })
const binding = Keymap.bind(chord, invocation)
```

`SetHeading` is a Command Tag carrying both the public command name and its user-facing parameter tuple. `CommandInvocation.make` does not accept a bare string, so it checks `{ level }` immediately. The Tag is separate from its Command Definitions; Final Validation checks that the complete Extension Union provides at least one implementation for it.

A Keymap may reference a Command Tag supplied later by another Extension. `Keymap.bind` and `Extension.union` preserve that Forward Reference without requiring an implementation. `EditingCore.create`, `EditingCore.make`, and `EditingCore.layer` are the first complete-editor boundaries and report a typed `MissingCommandImplementation` diagnostic inside Effect `FinalValidationError` when the final Extension Union still lacks an implementation.

Arguments that must be computed at runtime are passed through the Command Surface and are not represented by a Static Keymap Command Invocation.

Each `Keymap.bind` maps exactly one Key Chord to one Command Invocation. It does not accept an invocation list and there is no separate sequence abstraction. Authors express fallback behavior by contributing multiple bindings for the same chord, which are composed by Keymap Merge.

Bindings for the same Key Chord merge into a short-circuiting chain. Bindings run by descending contribution priority, with Extension Union declaration order breaking ties. A Command Invocation returning `false` passes handling to the next binding; the first invocation returning `true` stops the chain and consumes the key. Duplicate chords are therefore composable rather than a validation error.

The first phase does not support runtime keymap mutation. Dynamic keymaps are deferred until Effect-backed Plugin support is designed.

## Services

Extensions can declare Service Requirements:

```ts
Extension.Require(AiClient)
```

The application provides implementations when synchronously creating the editor:

```ts
createEditor({
  extension,
  layer: AiClientLive,
})
```

The first phase does not allow arbitrary business Layers to be embedded inside extensions.

`EditingCore.make` and `EditingCore.layer` expose extension requirements in their environment types. If an extension requires `AiClient`, then the core layer still requires `AiClient`:

```ts
EditingCore.layer({ extension })
// Layer.Layer<EditingCore, EditingCoreError, AiClient>
```

The application satisfies those requirements by providing Layers around the editor layer:

```ts
Effect.provide(program, Layer.mergeAll(AiClientLive, EditingCore.layer({ extension })))
```

Effect-native construction validates each declared service against its supplied Context and fails with `MissingServiceError { services }` when one is absent. `EditingCore.create` and `createEditor` instead require a no-input `layer` that provides every declared service. That Layer is built into the Editor Scope, so its resources are released with `destroy()`. Synchronous construction cannot await Layer acquisition: a failing or asynchronous Layer produces `ServiceLayerCreationError { cause }`; applications needing asynchronous provisioning use `EditingCore.make` or `EditingCore.layer`.

In the MVP, `Extension.Require(Tag)` is explicit because schema, command, and keymap contributions do not run Effect programs directly. Future `Extension.Actions` and `Extension.Plugin` APIs should automatically accumulate requirements from their Effect environment types, while `Extension.Require` remains available for explicit external contracts.

## Editor Creation

The library provides an Effect-native service layer and a convenience creation API.

`EditingCore` is both the runtime service contract and its Effect Context Tag. `EditingCore.layer` is the primary Effect-native entry point. It creates an Editor Scope and provides the current Editing Core:

```ts
const program = Effect.gen(function* () {
  const core = yield* EditingCore

  yield* core.transact(({ tr }) => {
    return tr.insertText("hello")
  })
}).pipe(Effect.provide(EditingCore.layer({ extension })), Effect.provide(appLayer))
```

`EditingCore.make(options)` is the lower-level scoped constructor with `Effect.Effect<EditingCore, EditingCoreError, Requirements | Scope>`. `EditingCore.layer(options)` provides `Layer.Layer<EditingCore, EditingCoreError, Requirements>`. `EditingCore.create(options)` is the synchronous convenience constructor: it owns an internal Scope until `core.destroy()` and throws the same tagged errors that Effect-native construction places in its error channel. No separate `EditorService` contract is introduced.

The service obtained through `yield* EditingCore.EditingCore` exposes the same synchronous ProseMirror-oriented surface as `EditingCore.create`: command operations and `transact` return direct booleans, while state and schema are direct getters. Effect manages construction, requirements, Scope, and future Actions; it does not duplicate these operations as `runEffect` or `transactEffect` and does not turn a synchronous ProseMirror Command into an Effect Command. Exceptional synchronous failures are still normalized to the agreed `Data.TaggedError` values.

`Editor.mount` binds an existing core to a DOM element and returns an Editor Instance. `createEditor` is the convenience constructor for application and framework code that creates and mounts a core in one call:

```ts
const core = EditingCore.create({
  extension,
  initialContent,
})

const editor = Editor.mount(core, element)

const mountedEditor = createEditor({
  extension,
  initialContent,
  element,
})
```

One Editing Core may have at most one active Editor Mount. Calling `Editor.mount` again while its current Editor Instance is mounted fails with an Effect `EditorAlreadyMountedError`. Selection, focus, DOM composition, and View-dependent command context are intentionally not shared across multiple active Views.

If `Editor.mount(core, element)` fails during EditorView or plugin View initialization, it cleans up every partial View resource, releases the active-mount reservation, and raises `EditorMountError { cause }`. Because `Editor.mount` borrows an existing core, that core remains live and unmounted so the caller may correct the problem and retry. Destroyed and already-mounted cores retain their separate `EditorDestroyedError` and `EditorAlreadyMountedError` classifications.

`createEditor` owns the core it creates, so its construction is transactional across core creation and mount. If mounting fails after `EditingCore.create` succeeds, it calls `core.destroy()` before rethrowing the original `EditorMountError`. The core and View become invalid synchronously while Scope finalizers continue through the destroy Promise. The synchronous constructor does not await cleanup; it observes cleanup rejection through the Effect runtime without replacing the mount failure.

`editor.unmount()` is idempotent. It destroys the active EditorView and removes state synchronization but leaves the Editing Core, its current state, and its Editor Scope alive. The core may then be mounted to another element. A View destruction exception is reported as `EditorUnmountError { cause }` only after the handle has been detached. `core.destroy()` is the irreversible boundary: it synchronously marks the core destroyed, automatically unmounts any active View, prevents every future mount, and returns a shared `Promise<void>` that completes after the Editor Scope's potentially asynchronous finalizers finish. A View destruction exception during core destruction rejects that Promise as `EditorDestructionError { cause }` rather than escaping synchronously.

Every Editor Instance, whether returned by `Editor.mount` or `createEditor`, exposes both `unmount()` and `destroy()`. `editor.destroy()` delegates to the same irreversible lifecycle transition as `core.destroy()`, while `editor.unmount()` remains View-only. The API does not infer cleanup ownership from which constructor produced the instance.

Unmounting permanently invalidates that Editor Instance. If the live core is later mounted again, the old handle never follows or aliases the new View. Apart from idempotent `unmount()` and `destroy()`, its View, state, schema, command, and transaction operations fail with an Effect `EditorUnmountedError`. Callers that need to continue editing use the explicit Editing Core or the newly mounted Editor Instance; there is no silent fallback from a stale View-bound surface to core-only execution.

Each Editing Core owns an Editor Scope. In the Effect-native API, the scope is managed by `Layer` / `Scope`. In the convenience API, `createEditor` owns the scope and exposes `destroy(): Promise<void>` on the mounted Editor Instance.

The first Editing Core accepts Initial Content through an Effect-style readonly tagged union:

```ts
type InitialContent =
  | { readonly _tag: "Node"; readonly node: Node }
  | { readonly _tag: "JSON"; readonly json: NodeJSON }
  | { readonly _tag: "HTML"; readonly html: string }
```

`Node` and `JSON` create state without a DOM. `HTML` uses the browser's global `document`; creating an Editing Core with HTML Initial Content outside a browser fails with `InitialContentDocumentUnavailableError` rather than introducing a DOM polyfill into the Editing Core.

`InitialContent.Node(node)` directly uses a Node only when `node.type.schema === core.schema`; a Node from another Schema fails with `InvalidInitialContentError { source: "Node", reason: "SchemaMismatch" }` rather than silently replacing the core schema. For an intentional cross-schema conversion, `InitialContent.JSON.fromNode(node)` snapshots `node.toJSON()` and then rebuilds it through the target schema's normal JSON path.

Initial Content adds no separate generic Effect Schema decoder for `NodeJSON`. Callers may decode unknown external data with their own `Schema.decodeUnknown` program and pass the result to `InitialContent.JSON`. ProseMirror `Node.fromJSON` remains the authoritative validation and construction step for node types, marks, attrs, and content expressions; the existing Effect Schema attribute support participates there through compiled ProseMirror attribute validation.

`initialContent` is optional. When omitted, the Editing Core uses `schema.topNodeType.createAndFill()` to create the initial document. A null result fails with `InitialContentCreationError { reason: "TopNodeCannotCreateAndFill" }`. Invalid explicit Node, JSON, or HTML content fails with `InvalidInitialContentError { source: "Node" | "JSON" | "HTML", cause }`. These tagged errors never expose raw ProseMirror exceptions.

## Editor Instance API

The Editor Instance exposes the underlying ProseMirror view and current editor state:

```ts
editor.view
editor.state
editor.schema
```

`state` and `schema` are getters backed by the Editing Core, which remains the sole state owner after mounting. The mount adapter maintains `core.state === editor.view.state`: DOM transactions enter the core through the View's `dispatchTransaction`, and every accepted core state change is projected back with `view.updateState(...)`.

If `view.updateState` throws after the core has accepted a transaction, the core does not attempt to roll back plugin state or external plugin effects. It retains the accepted state, immediately detaches and destroys the failing View, permanently invalidates that Editor Instance, and raises an Effect `EditorViewSynchronizationError { cause }`. The still-live core may then be mounted again.

Transaction submission should use a short-lived synchronous transaction boundary:

```ts
editor.transact(({ state, view, schema, tr }) => {
  return tr.insertText("hello")
})
```

`transact` reads the latest `EditorState`, creates `state.tr`, passes it to the callback, and immediately dispatches the returned transaction.

All transaction sources use the same core-owned dispatch path, including `EditingCore.commands`, mounted `Editor.commands`, Static Keymaps, explicit `transact`, and transactions produced by DOM input. Mounting never transfers state ownership to `EditorView` and never permits the core and View states to evolve independently.

```ts
type TransactionContext = {
  state: EditorState
  view: EditorView
  schema: Schema
  tr: Transaction
}

type Transact = (fn: (ctx: TransactionContext) => Transaction | false) => boolean
```

`transact` callbacks must be synchronous. Asynchronous work should complete first and then reenter through `transact` or the future Reentry API so the transaction is built from the current state.

The callback must explicitly return a Transaction or `false`. A returned Transaction enters the complete ProseMirror state application path even when it has no document steps, because it may carry selection changes or plugin metadata. `false` is the sole no-write result. `null`, `undefined`, `true`, and Promise values are invalid, so a missing `return` is caught by the callback type rather than silently becoming a no-op.

The core applies returned transactions with ProseMirror's `state.applyTransaction(transaction)`. `transact` returns `true` only when the root transaction is accepted; it then adopts the resulting final state, including all `appendTransaction` work. If a plugin's `filterTransaction` rejects the root transaction, the state remains unchanged and `transact` returns `false`. Selection-only or metadata-only accepted transactions still return `true`.

An exception from the callback or `applyTransaction` is never exposed raw. Both become an Effect `TransactionExecutionError` with `phase: "callback" | "apply"` and the original value as `cause`; callback failures leave state unchanged. Nested public writes use the distinct `TransactionReentryError`.

The callback is also a non-reentrant write boundary. It may inspect its context and call read-only `canRun` or `isActive` queries, but nested `transact` and a `commands.run` that would enter the dispatch path fail with an Effect `TransactionReentryError`. This prevents an inner write from advancing the core while the outer callback still holds a transaction based on the previous state. ProseMirror plugin application and `appendTransaction` processing inside one internal state application are not treated as public reentry.

The first public API does not add `core.dispatch(tr)` or `editor.dispatch(tr)`. Editing Core commands and the View adapter use an internal dispatch path, while host code uses `transact` so each transaction begins from the latest state. Advanced mounted integrations still have ProseMirror's original `editor.view.dispatch(tr)`, which the adapter routes through the core-owned state path. Avoiding a duplicate public dispatch method reduces accidental submission of transactions retained across asynchronous boundaries.

The convenience `createEditor` instance exposes synchronous operations:

```ts
editor.transact(fn): boolean
editor.destroy(): Promise<void>
```

`EditingCore.destroy()` is idempotent and returns the same completion Promise on repeated calls. The core becomes destroyed before that Promise is returned: Command Surface methods and `transact` return `false`; accessing `state` or `schema`, or attempting `Editor.mount`, fails with an `EditorDestroyedError` rather than returning stale data or reviving the scope. The Promise only represents completion of Editor Scope finalizers.

## Final Validation

Partial extensions are allowed, but creating an Editing Core requires Final Validation.

Final Validation checks that:

- node attributes target existing node specs
- mark attributes target existing mark specs
- keymaps reference Command Tags with at least one implementation
- keymap bindings provide required command arguments
- distinct Command Tags do not reuse one public command name
- the schema is complete enough to create a ProseMirror editor
- required services are provided

Type-level failures should be Typed Diagnostics, not opaque `never` failures. The first Final Validation slice covers node and mark attrs that target missing specs. `EditingCore.create`, `EditingCore.make`, and `EditingCore.layer` require a valid extension at the type level. The mounted `createEditor` convenience constructor inherits that validation by creating an Editing Core before mounting. `FinalValidation` resolves to `unknown` for a valid extension and exposes a diagnostic result for an invalid one, for example:

```ts
type MissingNodeTarget = {
  readonly extension: Diagnostic<
    "MissingNodeTarget",
    { readonly type: "paragraph"; readonly attr: "textAlign" }
  >
}
```

An extension with a valid Forward Reference passes Final Validation because validation examines the completed Extension Union rather than an individual contribution.

Runtime validation mirrors the type-level checks through one Effect `FinalValidationError { diagnostics }`, containing all unresolved and conflicting contributions found at the complete-core boundary. It does not stop at the first error. The lower-level `EditorSchema.create` API retains its narrower schema-specific error model when used directly.

Runtime validation errors should follow Effect conventions and use `Data.TaggedError`, not bare strings or generic errors. Public APIs do not directly expose raw ProseMirror exceptions; they may retain one as a tagged error's `cause`.

```ts
import { Data } from "effect"

class FinalValidationError extends Data.TaggedError("FinalValidationError")<{
  readonly diagnostics: readonly FinalValidationDiagnostic[]
}> {}

class EditorDestroyedError extends Data.TaggedError("EditorDestroyedError")<{}> {}
```

Effect-returning construction APIs report these errors through the Effect error channel. Direct synchronous ProseMirror-oriented operations and convenience constructors throw the same tagged error values.

## Type Model

The type model is based on raw contributions, not only final merged editor capabilities. This preserves Forward References and keeps Final Validation explicit.

Conceptually:

```ts
type ExtensionSpec = {
  NodeSpecs: Record<string, NodeSpecInfo>
  NodeAttrs: Record<string, Record<string, AttrInfo>>
  MarkSpecs: Record<string, MarkSpecInfo>
  MarkAttrs: Record<string, Record<string, AttrInfo>>
  CommandTags: readonly CommandTagInfo[]
  CommandDefinitions: readonly CommandDefinitionInfo[]
  KeyBindings: readonly KeyBindingInfo[]
  Requirements: unknown
}
```

`Extension.union` preserves raw contributions and local ordering without rejecting Forward References. At complete-core runtime Final Validation, definitions referencing the same Command Tag form a command chain, while distinct runtime Tags with the same public name produce a `DuplicateCommandName` diagnostic.

Completeness checks are deferred to `EditingCore.create`, `EditingCore.make`, and `EditingCore.layer`. These include missing node specs for node attrs, missing mark specs for mark attrs, and missing Command Tag implementations for keymaps. Declared services are validated against the construction Context or synchronous Layer at the same boundary.

Typed Diagnostics should carry readable details:

```ts
type Diagnostic<Message extends string, Detail> = {
  readonly __effectProsemirrorError: Message
  readonly detail: Detail
}
```

## Async Boundary

Asynchronous work is not modeled as commands. It belongs to Effectful Actions, which are deferred from the MVP API.

The intended model is:

- a synchronous command or UI event starts an Effectful Action
- the action uses Effect services and may track a Tracked Target
- when ready, the action performs Reentry against the current editor state
- Reentry submits a synchronous editing operation

This preserves ProseMirror's synchronous state and transaction model.

## Testing Strategy

Type behavior is part of the public API and must be tested explicitly.

Use Vitest for runtime tests and type-oriented tests. Use `expect-type` for positive type assertions and `@ts-expect-error` fixtures for negative type assertions.

Suggested layout:

```txt
test/type/
  commands.test-d.ts
  schema-final-validation.test-d.ts
  keymap.test-d.ts
  requirements.test-d.ts

test/runtime/
  extension-union.test.ts
  schema-merge.test.ts
  commands.test.ts
  editor-lifecycle.test.ts
```

The first CI checks should include:

```txt
pnpm test
pnpm typecheck
```
