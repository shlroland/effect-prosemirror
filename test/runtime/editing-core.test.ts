import { Context, Effect, Layer } from "effect"
import { Plugin, TextSelection } from "prosemirror-state"
import { describe, expect, it } from "vitest"

import {
  Command,
  CommandExecutionError,
  CommandNotAvailableError,
  EditingCore,
  EditorDestroyedError,
  EditorSchema,
  Extension,
  FinalValidationError,
  InitialContent,
  InitialContentDocumentUnavailableError,
  InvalidInitialContentError,
  MissingServiceError,
  Priority,
  ServiceLayerCreationError,
  TransactionExecutionError,
  TransactionReentryError,
} from "../../src/core.js"

const schemaExtension = Extension.union(
  Extension.NodeSpec({ name: "doc", content: "paragraph+" }),
  Extension.NodeSpec({ name: "paragraph", content: "text*" }),
  Extension.NodeSpec({ name: "text" }),
)

class InsertText extends Command.Tag("insertText")<InsertText, [text: string]>() {}
class IsTextActive extends Command.Tag("isTextActive")<IsTextActive, [text: string]>() {}
class AuditService extends Context.Tag("test/AuditService")<
  AuditService,
  { readonly name: string }
>() {}

const insertText = Command.define(InsertText, {
  run: (text) => (state, dispatch) => {
    if (text.length === 0) return false
    dispatch?.(state.tr.insertText(text))
    return true
  },
})

const isTextActive = Command.define(IsTextActive, {
  run: () => () => false,
  isActive: (text) => (state) => state.doc.textContent === text,
})

const auditServiceLive = Layer.succeed(AuditService, { name: "audit" })

describe("EditingCore", () => {
  it("creates a real schema and EditorState with default content", async () => {
    const core = EditingCore.create({ extension: schemaExtension })

    expect(core.schema.topNodeType.name).toBe("doc")
    expect(core.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    })

    await core.destroy()
  })

  it("creates initial state from JSON", async () => {
    const core = EditingCore.create({
      extension: schemaExtension,
      initialContent: InitialContent.JSON({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "hello" }],
          },
        ],
      }),
    })

    expect(core.state.doc.textContent).toBe("hello")
    await core.destroy()
  })

  it("accepts a Node from the memoized Extension schema", async () => {
    const schema = EditorSchema.create(schemaExtension)
    const node = schema.node("doc", null, [schema.node("paragraph", null, [schema.text("hello")])])
    const core = EditingCore.create({
      extension: schemaExtension,
      initialContent: InitialContent.Node(node),
    })

    expect(core.schema).toBe(schema)
    expect(core.state.doc).toBe(node)
    await core.destroy()
  })

  it("converts a foreign Node through the explicit JSON bridge", async () => {
    const foreignExtension = Extension.union(
      Extension.NodeSpec({ name: "doc", content: "paragraph+" }),
      Extension.NodeSpec({ name: "paragraph", content: "text*" }),
      Extension.NodeSpec({ name: "text" }),
    )
    const foreignSchema = EditorSchema.create(foreignExtension)
    const node = foreignSchema.node("doc", null, [
      foreignSchema.node("paragraph", null, [foreignSchema.text("hello")]),
    ])
    const core = EditingCore.create({
      extension: schemaExtension,
      initialContent: InitialContent.JSON.fromNode(node),
    })

    expect(core.state.doc.textContent).toBe("hello")
    expect(core.state.doc).not.toBe(node)
    await core.destroy()
  })

  it("rejects a foreign Node at the strict Node boundary", () => {
    const foreignExtension = Extension.union(
      Extension.NodeSpec({ name: "doc", content: "paragraph+" }),
      Extension.NodeSpec({ name: "paragraph", content: "text*" }),
      Extension.NodeSpec({ name: "text" }),
    )
    const foreignSchema = EditorSchema.create(foreignExtension)
    const node = foreignSchema.topNodeType.createAndFill()

    expect(node).not.toBeNull()
    expect(() =>
      EditingCore.create({
        extension: schemaExtension,
        initialContent: InitialContent.Node(node!),
      }),
    ).toThrow(InvalidInitialContentError)
  })

  it("wraps invalid JSON initial content", () => {
    expect(() =>
      EditingCore.create({
        extension: schemaExtension,
        initialContent: InitialContent.JSON({ type: "missing" }),
      }),
    ).toThrow(InvalidInitialContentError)
  })

  it("reports unavailable browser document for HTML in Node", () => {
    expect(() =>
      EditingCore.create({
        extension: schemaExtension,
        initialContent: InitialContent.HTML("<p>hello</p>"),
      }),
    ).toThrow(InitialContentDocumentUnavailableError)
  })

  it("runs Tag-driven commands against current state", async () => {
    const extension = Extension.union(schemaExtension, Extension.Commands(insertText, isTextActive))
    const core = EditingCore.create({ extension })

    expect(core.commands.canRun(InsertText, "hello")).toBe(true)
    expect(core.commands.run(InsertText, "hello")).toBe(true)
    expect(core.state.doc.textContent).toBe("hello")
    expect(core.commands.isActive(IsTextActive, "hello")).toBe(true)

    await core.destroy()
  })

  it("merges definitions by priority and short-circuits on true", async () => {
    const calls: string[] = []
    class Handle extends Command.Tag("handle")<Handle, []>() {}

    const low = Extension.Commands(
      Command.define(Handle, {
        run: () => () => {
          calls.push("low")
          return true
        },
      }),
    ).pipe(Extension.priority(Priority.Low))

    const high = Extension.Commands(
      Command.define(Handle, {
        run: () => () => {
          calls.push("high")
          return false
        },
      }),
    ).pipe(Extension.priority(Priority.High))

    const core = EditingCore.create({
      extension: Extension.union(schemaExtension, low, high),
    })

    expect(core.commands.run(Handle)).toBe(true)
    expect(calls).toEqual(["high", "low"])
    await core.destroy()
  })

  it("distinguishes an unavailable Tag from a command returning false", async () => {
    class Missing extends Command.Tag("missing")<Missing, []>() {}
    const core = EditingCore.create({
      extension: Extension.union(schemaExtension, Extension.Commands(insertText)),
    })

    expect(() => core.commands.run(Missing as unknown as typeof InsertText, "text")).toThrow(
      CommandNotAvailableError,
    )
    await core.destroy()
  })

  it("wraps raw command failures with operation context", async () => {
    class Failing extends Command.Tag("failing")<Failing, []>() {}
    const cause = new RangeError("failed")
    const core = EditingCore.create({
      extension: Extension.union(
        schemaExtension,
        Extension.Commands(
          Command.define(Failing, {
            run: () => () => {
              throw cause
            },
          }),
        ),
      ),
    })

    try {
      core.commands.run(Failing)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(CommandExecutionError)
      expect(error).toMatchObject({ command: "failing", operation: "run", cause })
    }

    await core.destroy()
  })

  it("applies transactions and supports an explicit false branch", async () => {
    const core = EditingCore.create({ extension: schemaExtension })

    expect(core.transact(({ tr }) => tr.insertText("hello"))).toBe(true)
    expect(core.state.doc.textContent).toBe("hello")
    expect(core.transact(() => false)).toBe(false)

    await core.destroy()
  })

  it("rejects nested writes", async () => {
    const core = EditingCore.create({ extension: schemaExtension })

    expect(() =>
      core.transact(({ tr }) => {
        core.transact(({ tr: inner }) => inner.insertText("inner"))
        return tr.insertText("outer")
      }),
    ).toThrow(TransactionReentryError)

    await core.destroy()
  })

  it("wraps transaction callback failures", async () => {
    const cause = new Error("callback failed")
    const core = EditingCore.create({ extension: schemaExtension })

    try {
      core.transact(() => {
        throw cause
      })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(TransactionExecutionError)
      expect(error).toMatchObject({ phase: "callback", cause })
    }

    await core.destroy()
  })

  it("invalidates synchronously and closes idempotently", async () => {
    const core = EditingCore.create({
      extension: Extension.union(schemaExtension, Extension.Commands(insertText)),
    })

    const first = core.destroy()
    const second = core.destroy()

    expect(first).toBe(second)
    expect(core.commands.run(InsertText, "ignored")).toBe(false)
    expect(core.transact(({ tr }) => tr.insertText("ignored"))).toBe(false)
    expect(() => core.state).toThrow(EditorDestroyedError)

    await first
  })

  it("supports scoped Effect construction and Context provisioning", async () => {
    let scopedCore: EditingCore.Any | undefined

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          scopedCore = yield* EditingCore.make({ extension: schemaExtension })
          expect(scopedCore.state.doc.type.name).toBe("doc")
        }),
      ),
    )

    expect(() => scopedCore?.state).toThrow(EditorDestroyedError)

    const documentType = await Effect.runPromise(
      Effect.gen(function* () {
        const core = yield* EditingCore.EditingCore
        return core.state.doc.type.name
      }).pipe(Effect.provide(EditingCore.layer({ extension: schemaExtension }))),
    )

    expect(documentType).toBe("doc")
  })

  it("validates Extension service requirements through Effect and synchronous Layers", async () => {
    const extension = Extension.union(schemaExtension, Extension.Require(AuditService))
    const makeUnsafe = EditingCore.make as (
      options: EditingCore.Options,
    ) => Effect.Effect<EditingCore.Any, EditingCore.CreationError, never>
    const createUnsafe = EditingCore.create as (options: EditingCore.Options) => EditingCore.Any

    const missingServiceExit = await Effect.runPromiseExit(Effect.scoped(makeUnsafe({ extension })))
    expect(missingServiceExit).toMatchObject({
      _tag: "Failure",
      cause: {
        _tag: "Fail",
        error: {
          _tag: "MissingServiceError",
          services: ["test/AuditService"],
        },
      },
    })
    expect(() => createUnsafe({ extension })).toThrow(MissingServiceError)
    const failingLayer = Layer.fail(new Error("service layer failed")) as unknown as Layer.Layer<
      AuditService,
      never,
      never
    >
    expect(() => (EditingCore.create as Function)({ extension, layer: failingLayer })).toThrow(
      ServiceLayerCreationError,
    )

    const schemaName = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const core = yield* EditingCore.make({ extension })
          return core.schema.topNodeType.name
        }).pipe(Effect.provide(auditServiceLive)),
      ),
    )
    expect(schemaName).toBe("doc")

    const layerSchemaName = await Effect.runPromise(
      Effect.gen(function* () {
        const core = yield* EditingCore.EditingCore
        return core.schema.topNodeType.name
      }).pipe(Effect.provide(EditingCore.layer({ extension })), Effect.provide(auditServiceLive)),
    )
    expect(layerSchemaName).toBe("doc")

    const core = EditingCore.create({ extension, layer: auditServiceLive })
    expect(core.schema.topNodeType.name).toBe("doc")
    await core.destroy()
  })

  it("aggregates runtime Final Validation diagnostics", () => {
    const invalid = Extension.union(
      schemaExtension,
      Extension.NodeAttr({
        type: "missing",
        attr: "value",
        default: null,
      }),
    )

    const createUnsafe = EditingCore.create as (options: EditingCore.Options) => EditingCore.Any

    expect(() => createUnsafe({ extension: invalid })).toThrow(FinalValidationError)
  })

  it("rejects distinct Command Tags with the same public name", () => {
    class First extends Command.Tag("duplicate")<First, []>() {}
    class Second extends Command.Tag("duplicate")<Second, []>() {}
    const extension = Extension.union(
      schemaExtension,
      Extension.Commands(
        Command.define(First, { run: () => () => false }),
        Command.define(Second, { run: () => () => false }),
      ),
    )

    try {
      EditingCore.create({ extension })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(FinalValidationError)
      expect((error as FinalValidationError).diagnostics).toContainEqual({
        _tag: "DuplicateCommandName",
        command: "duplicate",
      })
    }
  })

  it("notifies a Core Subscription after an accepted state change", async () => {
    const core = EditingCore.create({ extension: schemaExtension })
    const observed: string[] = []

    core.subscribe(() => {
      observed.push(core.state.doc.textContent)
    })

    expect(core.transact(({ tr }) => tr.insertText("hello"))).toBe(true)
    expect(observed).toEqual(["hello"])

    await core.destroy()
  })

  it("does not notify a Core Subscription when a transaction is rejected", async () => {
    const core = EditingCore.create({ extension: schemaExtension })
    const calls: number[] = []

    core.subscribe(() => {
      calls.push(1)
    })

    expect(core.transact(() => false)).toBe(false)
    expect(calls).toEqual([])

    await core.destroy()
  })

  it("does not notify a Core Subscription when a State Plugin rejects the transaction", async () => {
    const core = EditingCore.create({
      extension: Extension.union(
        schemaExtension,
        Extension.Plugin(
          new Plugin({
            filterTransaction: (transaction) => !transaction.docChanged,
          }),
        ),
      ),
    })
    const calls: number[] = []

    core.subscribe(() => {
      calls.push(1)
    })

    expect(core.transact(({ tr }) => tr.insertText("blocked"))).toBe(false)
    expect(calls).toEqual([])

    await core.destroy()
  })

  it("stops notifying after a Core Subscription is removed", async () => {
    const core = EditingCore.create({ extension: schemaExtension })
    const observed: string[] = []
    const unsubscribe = core.subscribe(() => {
      observed.push(core.state.doc.textContent)
    })

    expect(core.transact(({ tr }) => tr.insertText("one"))).toBe(true)
    unsubscribe()
    expect(core.transact(({ tr }) => tr.insertText("two"))).toBe(true)
    expect(observed).toEqual(["one"])

    await core.destroy()
  })

  it("notifies a Core Subscription after a selection-only change", async () => {
    const core = EditingCore.create({ extension: schemaExtension })
    expect(core.transact(({ tr }) => tr.insertText("hello"))).toBe(true)

    const observed: number[] = []
    core.subscribe(() => {
      observed.push(core.state.selection.from)
    })

    expect(
      core.transact(({ state, tr }) => tr.setSelection(TextSelection.create(state.doc, 1))),
    ).toBe(true)
    expect(observed).toEqual([1])
    expect(core.state.doc.textContent).toBe("hello")

    await core.destroy()
  })

  it("notifies a Core Subscription with state that includes appended transactions", async () => {
    const appended = "test/subscription-appended"
    const core = EditingCore.create({
      extension: Extension.union(
        schemaExtension,
        Extension.Plugin(
          new Plugin({
            appendTransaction: (transactions, _, state) =>
              transactions.some(
                (transaction) => transaction.docChanged && transaction.getMeta(appended) !== true,
              )
                ? state.tr.insertText("!", state.selection.to).setMeta(appended, true)
                : undefined,
          }),
        ),
      ),
    })
    const observed: string[] = []

    core.subscribe(() => {
      observed.push(core.state.doc.textContent)
    })

    expect(core.transact(({ tr }) => tr.insertText("hello"))).toBe(true)
    expect(observed).toEqual(["hello!"])

    await core.destroy()
  })

  it("rejects Core Subscription registration after destroy", async () => {
    const core = EditingCore.create({ extension: schemaExtension })
    const done = core.destroy()

    expect(() => core.subscribe(() => undefined)).toThrow(EditorDestroyedError)

    await done
  })

  it("throws when a Core Subscription dispatches during notification", async () => {
    const core = EditingCore.create({ extension: schemaExtension })
    core.subscribe(() => {
      core.transact(({ tr }) => tr.insertText("nested"))
    })

    expect(() => core.transact(({ tr }) => tr.insertText("hello"))).toThrow(TransactionReentryError)
    expect(core.state.doc.textContent).toBe("hello")

    await core.destroy()
  })
})
