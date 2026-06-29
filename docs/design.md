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

Extension.Commands(commands)
Extension.Keymap(bindings)

Extension.Require(serviceTag)

Editor.layer(options)
Editor.make(options)
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
import { Editor, Extension, Command, Priority, createEditor } from "effect-prosemirror"
import { Editor } from "effect-prosemirror/core/Editor"
import { Extension } from "effect-prosemirror/core/Extension"
import { Command } from "effect-prosemirror/core/Command"
```

The first phase should provide core exports. Extension and framework paths can be added as they are implemented.

Built-in extensions should use module-level `make` functions rather than `defineXx` names:

```ts
import * as Doc from "effect-prosemirror/extensions/doc"
import * as Text from "effect-prosemirror/extensions/text"
import * as Paragraph from "effect-prosemirror/extensions/paragraph"
import * as Basic from "effect-prosemirror/extensions/basic"

const extension = Extension.union(
  Doc.make(),
  Text.make(),
  Paragraph.make(),
)

const basic = Basic.make()
```

The first built-in extensions should be minimal and exist to validate the core model: `Doc.make()`, `Text.make()`, `Paragraph.make()`, and `Basic.make()`.

`Basic.make()` follows a minimal-usable principle:

```ts
Basic.make() = Extension.union(
  Doc.make(),
  Text.make(),
  Paragraph.make(),
  BaseCommands.make(),
)
```

It should not include history, keymaps, marks, lists, tables, drop cursor, or gap cursor in the first phase.

## Extension Contributions

An Extension is a typed collection of independent Extension Contributions. Contributions are composed with `Extension.union`.

Extensions are pipeable and should implement Effect's public `Pipeable` shape so modifiers compose in Effect style:

```ts
Extension.NodeSpec({
  name: "paragraph",
  content: "inline*",
}).pipe(
  Extension.union(Extension.NodeAttr({
    type: "paragraph",
    attr: "textAlign",
    spec: { default: null },
  })),
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
const root = Extension.union(
  Doc.make(),
  Text.make(),
  Paragraph.make(),
)

const paragraph = Paragraph.make().pipe(
  Extension.union(BaseParagraphCommands.make()),
)
```

The pipeable form prepends the receiver to the union, so `a.pipe(Extension.union(b, c))` has the same contribution order and tuple shape as `Extension.union(a, b, c)`.

Extensions support priority as a pipeable modifier:

```ts
Extension.union(
  Extension.MarkSpec({ name: "bold" }),
  Extension.Commands({ toggleBold: Command.define({ run }) }),
).pipe(
  Extension.priority(Priority.High),
)
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

export type Priority = typeof Priority[keyof typeof Priority]
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
  default: null,
})

Extension.MarkSpec({
  name: "bold",
  parseDOM: [{ tag: "strong" }],
  toDOM: () => ["strong", 0],
})

Extension.MarkAttr({
  type: "link",
  attr: "href",
  default: null,
})
```

`NodeAttr` and `MarkAttr` may use Forward References. A partial extension can declare an attribute for a node or mark that is declared elsewhere in the final Extension Union.

Schema merge should follow ProseKit's behavior:

- same-named `NodeSpec` and `MarkSpec` contributions are merged instead of rejected
- `attrs` are merged by attribute name
- `parseDOM` arrays are appended
- ordinary object fields are merged with later or higher-priority contributions taking precedence
- `NodeAttr` and `MarkAttr` augment an existing node or mark contribution during Final Validation
- attribute contributions can wrap `toDOM` and `parseDOM` behavior so added attributes participate in serialization and parsing
- missing node or mark targets are Final Validation errors, not errors at `NodeAttr` / `MarkAttr` creation time

The current schema merge entry point is `Schema.collect(extension)`. It collects schema contributions from an Extension and returns merged node and mark spec records. At this stage it handles same-name `NodeSpec` and `MarkSpec` merging, including priority order, `attrs` merging, and `parseDOM` append behavior. Attribute contributions, parse/serialize wrapping, and Final Validation remain separate follow-up steps.

## Commands

Commands are synchronous ProseMirror editing operations. A command creator receives user-facing arguments and returns a synchronous ProseMirror command.

```ts
Extension.Commands({
  toggleBold: Command.define({
    run: () => (state, dispatch, view) => {
      return true
    },
  }),

  setTextColor: Command.define({
    run: (options: { color: string }) => (state, dispatch) => {
      return true
    },
  }),
})
```

The composed editor exposes a typed Command Surface:

```ts
editor.commands.toggleBold()
editor.commands.setTextColor({ color: "red" })
```

Command Surface methods execute against the current editor state and return `boolean`. They do not return ProseMirror command functions.

Command Surface methods also expose synchronous state queries:

```ts
editor.commands.toggleBold.canExec()
editor.commands.toggleBold.isActive()

editor.commands.setTextColor.canExec({ color: "red" })
editor.commands.setTextColor.isActive({ color: "red" })
```

`canExec` is derived by running the command without dispatch. `isActive` is also synchronous and reads the current editor state. The first phase should support `isActive` on `Command.define`, while keeping it optional.

When `isActive` is provided, its user-facing parameters must match `run`. If `isActive` is omitted, the command surface still exposes `.isActive(...)`, which returns `false`.

Same-named commands may merge only when their parameter types are compatible. The merge semantics are synchronous chaining: commands are tried in priority order until one returns `true`.

For same-named command merges, state queries use `some` semantics. `canExec` is true if any merged command can execute. `isActive` is true if any merged command reports active.

`Command.define({ run })` is required instead of accepting arbitrary functions. This brands command definitions, keeps synchronous return types explicit, and leaves room for future command metadata or state queries without changing the API shape.

`run` should not receive Effect services or an editor-specific context. Command follows ProseMirror's existing synchronous command concept, so service-dependent or asynchronous workflows belong to the future Action API.

## Keymaps

The first phase supports static keymaps that reference the Command Surface.

No-argument commands can be bound by name:

```ts
Extension.Keymap({
  "Mod-b": "toggleBold",
})
```

Commands with one argument can be bound with a tuple:

```ts
Extension.Keymap({
  "Mod-Alt-1": ["setHeading", { level: 1 }],
})
```

The first phase does not support runtime keymap mutation. Dynamic keymaps are deferred until Effect-backed Plugin support is designed.

## Services

Extensions can declare Service Requirements:

```ts
Extension.Require(AiClient)
```

The application provides implementations when creating the editor:

```ts
createEditor({
  extension,
  layer: AiClientLive,
})
```

The first phase does not allow arbitrary business Layers to be embedded inside extensions.

`Editor.layer` must expose extension requirements in its environment type. If an extension requires `AiClient`, then the editor layer still requires `AiClient`:

```ts
Editor.layer({ extension, element })
// Layer.Layer<EditorService, EditorError, AiClient>
```

The application satisfies those requirements by providing Layers around the editor layer:

```ts
Effect.provide(
  program,
  Layer.mergeAll(
    AiClientLive,
    Editor.layer({ extension, element }),
  ),
)
```

`createEditor` performs Final Validation against the provided `layer`. Missing service implementations should produce Typed Diagnostics.

In the MVP, `Extension.Require(Tag)` is explicit because schema, command, and keymap contributions do not run Effect programs directly. Future `Extension.Actions` and `Extension.Plugin` APIs should automatically accumulate requirements from their Effect environment types, while `Extension.Require` remains available for explicit external contracts.

## Editor Creation

The library provides an Effect-native service layer and a convenience creation API.

`Editor.layer` is the primary Effect-native entry point. It creates an Editor Scope and provides the current editor as an `EditorService` service:

```ts
const program = Effect.gen(function* () {
  const editor = yield* EditorService

  yield* editor.transact(({ tr }) => {
    return tr.insertText("hello")
  })
}).pipe(
  Effect.provide(Editor.layer({ extension, element })),
  Effect.provide(appLayer),
)
```

`Editor.make` may exist as a lower-level constructor used by `Editor.layer`, but `Editor.layer` is the API that lets other Effect programs depend on the current editor through the environment.

`createEditor` is the convenience constructor for application and framework code:

```ts
const editor = createEditor({
  extension,
  element,
  layer,
})
```

Each created editor owns an Editor Scope. In the Effect-native API, the scope is managed by `Layer` / `Scope`. In the convenience API, `createEditor` owns the scope and exposes `destroy(): void`.

## Editor Instance API

The Editor Instance exposes the underlying ProseMirror view and current editor state:

```ts
editor.view
editor.state
editor.schema
```

`state` and `schema` are getters. They must read from `editor.view.state` each time instead of caching the state at editor creation.

Transaction submission should use a short-lived synchronous transaction boundary:

```ts
editor.transact(({ state, view, schema, tr }) => {
  return tr.insertText("hello")
})
```

`transact` reads the latest `EditorState`, creates `state.tr`, passes it to the callback, and immediately dispatches the returned transaction.

```ts
type TransactionContext = {
  state: EditorState
  view: EditorView
  schema: Schema
  tr: Transaction
}

type Transact = (
  fn: (
    ctx: TransactionContext,
  ) => Transaction | null | undefined | false,
) => boolean
```

`transact` callbacks must be synchronous. Asynchronous work should complete first and then reenter through `transact` or the future Reentry API so the transaction is built from the current state.

Direct transaction dispatch may be exposed for advanced usage:

```ts
editor.dispatch(tr)
```

The primary path should remain `editor.transact(...)` and typed command surface methods, because holding a transaction across asynchronous boundaries can make it stale.

The Effect-native `EditorService` service exposes Effect-returning operations:

```ts
editor.transact(fn): Effect.Effect<boolean>
```

The convenience `createEditor` instance exposes synchronous operations:

```ts
editor.transact(fn): boolean
editor.destroy(): void
```

`destroy()` is idempotent. After destroy, command surface methods and `transact` return `false`. Accessing `state` or `schema` after destroy should fail with an `EditorDestroyedError` rather than returning stale data.

## Final Validation

Partial extensions are allowed, but creating an editor requires Final Validation.

Final Validation checks that:

- node attributes target existing node specs
- mark attributes target existing mark specs
- keymaps reference existing commands
- keymap bindings provide required command arguments
- the schema is complete enough to create a ProseMirror editor
- required services are provided

Type-level failures should be Typed Diagnostics, not opaque `never` failures.

Runtime validation should mirror the type-level checks.

Runtime validation errors should follow Effect conventions and use `Data.TaggedError`, not bare strings or generic errors:

```ts
import { Data } from "effect"

class MissingNodeSpecError extends Data.TaggedError("MissingNodeSpecError")<{
  readonly node: string
  readonly attr: string
}> {}

class MissingMarkSpecError extends Data.TaggedError("MissingMarkSpecError")<{
  readonly mark: string
  readonly attr: string
}> {}

class MissingCommandError extends Data.TaggedError("MissingCommandError")<{
  readonly command: string
  readonly key: string
}> {}

class EditorDestroyedError extends Data.TaggedError("EditorDestroyedError")<{}> {}
```

Effect-native APIs report these errors through the Effect error channel. Convenience APIs may throw, but should throw the same tagged error values.

## Type Model

The type model is based on raw contributions, not only final merged editor capabilities. This preserves Forward References and keeps Final Validation explicit.

Conceptually:

```ts
type ExtensionSpec = {
  NodeSpecs: Record<string, NodeSpecInfo>
  NodeAttrs: Record<string, Record<string, AttrInfo>>
  MarkSpecs: Record<string, MarkSpecInfo>
  MarkAttrs: Record<string, Record<string, AttrInfo>>
  Commands: Record<string, CommandCreator>
  Keymaps: Record<string, KeymapBinding>
  Requirements: unknown
}
```

`Extension.union` performs local merge checks that are meaningful at composition time. For example, same-named commands must have compatible parameters because command chaining is decided by the union.

Completeness checks are deferred to `Editor.make` and `createEditor`. These include missing node specs for node attrs, missing mark specs for mark attrs, missing command targets for keymaps, incomplete schema requirements, and missing service implementations.

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
