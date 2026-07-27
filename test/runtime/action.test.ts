// @vitest-environment jsdom

import { Context, Data, Deferred, Effect, Exit, Fiber, Layer } from "effect"
import { Plugin, TextSelection } from "prosemirror-state"
import { describe, expect, it } from "vitest"

import {
  Action,
  ActionNotAvailableError,
  EditingCore,
  Extension,
  FinalValidationError,
  InitialContent,
  TrackedSelectionEmptyError,
  TrackedTargetLostError,
} from "../../src/core.js"
import { createEditor } from "../../src/index.js"
import * as Basic from "../../src/extensions/basic.js"

interface RewriteRequest {
  readonly text: string
  readonly instruction: string
}

interface RewriteResult {
  readonly replacement: string
}

class RewriteError extends Data.TaggedError("RewriteError")<{
  readonly cause: unknown
}> {}

class SourceChangedError extends Data.TaggedError("SourceChangedError")<{}> {}

class Rewriter extends Context.Tag("test/Rewriter")<
  Rewriter,
  {
    readonly rewrite: (request: RewriteRequest) => Effect.Effect<string, RewriteError>
  }
>() {}

class RewriteSelection extends Action.Tag("rewriteSelection")<
  RewriteSelection,
  [instruction: string],
  RewriteResult,
  RewriteError | SourceChangedError
>() {}

class MissingAction extends Action.Tag("missingAction")<MissingAction, [], void, never>() {}

const rewriteSelection = Action.define(RewriteSelection, (instruction) =>
  Effect.gen(function* () {
    const source = yield* Action.trackSelection({ requireNonEmpty: true })
    const rewriter = yield* Rewriter
    const replacement = yield* rewriter.rewrite({
      text: source.snapshot.text,
      instruction,
    })

    return yield* Action.reenter(source, ({ target, tr }) =>
      target.changed
        ? Action.reject(new SourceChangedError())
        : Action.apply(tr.insertText(replacement, target.from, target.to), { replacement }),
    )
  }),
)

const initialContent = InitialContent.JSON({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "hello world" }],
    },
  ],
})

interface RewriteControl {
  readonly started: Deferred.Deferred<RewriteRequest>
  readonly response: Deferred.Deferred<string>
  readonly finalized: Deferred.Deferred<void>
  readonly service: Context.Tag.Service<Rewriter>
}

const makeRewriteControl = (): RewriteControl => {
  const started = Effect.runSync(Deferred.make<RewriteRequest>())
  const response = Effect.runSync(Deferred.make<string>())
  const finalized = Effect.runSync(Deferred.make<void>())

  return {
    started,
    response,
    finalized,
    service: {
      rewrite: (request) =>
        Effect.gen(function* () {
          yield* Deferred.succeed(started, request)
          return yield* Deferred.await(response)
        }).pipe(Effect.ensuring(Deferred.succeed(finalized, undefined))),
    },
  }
}

const makeCore = (control: RewriteControl) =>
  EditingCore.create({
    extension: Extension.union(Basic.make(), Extension.Actions(rewriteSelection)),
    initialContent,
    layer: Layer.succeed(Rewriter, control.service),
  })

const selectWorld = (core: EditingCore.Any): void => {
  core.transact(({ state, tr }) => tr.setSelection(TextSelection.create(state.doc, 7, 12)))
}

describe("Action", () => {
  it("does not begin an Action Execution until its Effect is run", async () => {
    let executions = 0

    class CountExecution extends Action.Tag("countExecution")<
      CountExecution,
      [],
      number,
      never
    >() {}

    const extension = Extension.union(
      Basic.make(),
      Extension.Actions(
        Action.define(CountExecution, () =>
          Effect.sync(() => {
            executions += 1
            return executions
          }),
        ),
      ),
    )
    const core = EditingCore.create({ extension })

    const program = core.actions.run(CountExecution)

    expect(executions).toBe(0)
    await expect(Effect.runPromise(program)).resolves.toBe(1)
    expect(executions).toBe(1)

    await core.destroy()
  })

  it("maps a Tracked Selection through edits before it and Reenters the latest state", async () => {
    const control = makeRewriteControl()
    const core = makeCore(control)
    selectWorld(core)

    const fiber = Effect.runFork(core.actions.run(RewriteSelection, "shorter"))
    await expect(Effect.runPromise(Deferred.await(control.started))).resolves.toEqual({
      text: "world",
      instruction: "shorter",
    })

    core.transact(({ tr }) => tr.insertText("say ", 1))
    yieldResponse(control, "earth")

    await expect(Effect.runPromise(Fiber.join(fiber))).resolves.toEqual({
      replacement: "earth",
    })
    expect(core.state.doc.textContent).toBe("say hello earth")

    await core.destroy()
  })

  it("maps a Tracked Selection through a State Plugin appended transaction", async () => {
    const control = makeRewriteControl()
    const appendBeforeTarget = "test/append-before-target"
    const core = EditingCore.create({
      extension: Extension.union(
        Basic.make(),
        Extension.Actions(rewriteSelection),
        Extension.Plugin(
          new Plugin({
            appendTransaction: (transactions, _, state) =>
              transactions.some((transaction) => transaction.getMeta(appendBeforeTarget) === true)
                ? state.tr.insertText("say ", 1)
                : undefined,
          }),
        ),
      ),
      initialContent,
      layer: Layer.succeed(Rewriter, control.service),
    })
    selectWorld(core)

    const fiber = Effect.runFork(core.actions.run(RewriteSelection, "shorter"))
    await Effect.runPromise(Deferred.await(control.started))

    core.transact(({ tr }) => tr.setMeta(appendBeforeTarget, true))
    yieldResponse(control, "earth")

    await expect(Effect.runPromise(Fiber.join(fiber))).resolves.toEqual({
      replacement: "earth",
    })
    expect(core.state.doc.textContent).toBe("say hello earth")

    await core.destroy()
  })

  it("reports Tracked Target Change without overwriting concurrent user edits", async () => {
    const control = makeRewriteControl()
    const core = makeCore(control)
    selectWorld(core)

    const fiber = Effect.runFork(core.actions.run(RewriteSelection, "shorter"))
    await Effect.runPromise(Deferred.await(control.started))

    core.transact(({ tr }) => tr.insertText("X", 8))
    yieldResponse(control, "earth")

    await expect(Effect.runPromise(Effect.flip(Fiber.join(fiber)))).resolves.toBeInstanceOf(
      SourceChangedError,
    )
    expect(core.state.doc.textContent).toBe("hello wXorld")

    await core.destroy()
  })

  it("prevents Reentry after Tracked Target Loss", async () => {
    const control = makeRewriteControl()
    const core = makeCore(control)
    selectWorld(core)

    const fiber = Effect.runFork(core.actions.run(RewriteSelection, "shorter"))
    await Effect.runPromise(Deferred.await(control.started))

    core.transact(({ tr }) => tr.delete(7, 12))
    yieldResponse(control, "earth")

    await expect(Effect.runPromise(Effect.flip(Fiber.join(fiber)))).resolves.toBeInstanceOf(
      TrackedTargetLostError,
    )
    expect(core.state.doc.textContent).toBe("hello ")

    await core.destroy()
  })

  it("rejects empty selection capture without starting the external service", async () => {
    const control = makeRewriteControl()
    const core = makeCore(control)

    await expect(
      Effect.runPromise(Effect.flip(core.actions.run(RewriteSelection, "shorter"))),
    ).resolves.toBeInstanceOf(TrackedSelectionEmptyError)
    expect(Effect.runSync(Deferred.poll(control.started))._tag).toBe("None")

    await core.destroy()
  })

  it("keeps a started Action Execution alive after Editor Unmount", async () => {
    const control = makeRewriteControl()
    const element = document.body.appendChild(document.createElement("div"))
    const editor = createEditor({
      extension: Extension.union(Basic.make(), Extension.Actions(rewriteSelection)),
      initialContent,
      layer: Layer.succeed(Rewriter, control.service),
      element,
    })
    selectWorld(editor.core)

    const fiber = Effect.runFork(editor.actions.run(RewriteSelection, "shorter"))
    await Effect.runPromise(Deferred.await(control.started))
    editor.unmount()
    yieldResponse(control, "earth")

    await expect(Effect.runPromise(Fiber.join(fiber))).resolves.toEqual({
      replacement: "earth",
    })
    expect(editor.core.state.doc.textContent).toBe("hello earth")

    await editor.destroy()
  })

  it("interrupts Action Executions and their finalizers when the Editing Core is destroyed", async () => {
    const control = makeRewriteControl()
    const core = makeCore(control)
    selectWorld(core)

    const fiber = Effect.runFork(core.actions.run(RewriteSelection, "shorter"))
    await Effect.runPromise(Deferred.await(control.started))
    await core.destroy()

    await Effect.runPromise(Deferred.await(control.finalized))
    const exit = await Effect.runPromise(Fiber.await(fiber))
    expect(Exit.isInterrupted(exit)).toBe(true)
  })

  it("allows the caller to interrupt an Action Execution without destroying the core", async () => {
    const control = makeRewriteControl()
    const core = makeCore(control)
    selectWorld(core)

    const fiber = Effect.runFork(core.actions.run(RewriteSelection, "shorter"))
    await Effect.runPromise(Deferred.await(control.started))
    const exit = await Effect.runPromise(Fiber.interrupt(fiber))

    expect(Exit.isInterrupted(exit)).toBe(true)
    await Effect.runPromise(Deferred.await(control.finalized))
    expect(core.state.doc.textContent).toBe("hello world")

    await core.destroy()
  })

  it("reports an unavailable Action Tag separately from Action failure", async () => {
    const extension = Extension.union(
      Basic.make(),
      Extension.Actions(Action.define(MissingAction, () => Effect.void)),
    )
    const core = EditingCore.create({ extension })

    class UnsafeMissing extends Action.Tag("unsafeMissing")<UnsafeMissing, [], void, never>() {}

    const error = await Effect.runPromise(
      Effect.flip(core.actions.run(UnsafeMissing as unknown as typeof MissingAction)),
    )
    expect(error).toBeInstanceOf(ActionNotAvailableError)

    await core.destroy()
  })

  it("rejects duplicate Action Definitions during Final Validation", () => {
    const definition = Action.define(MissingAction, () => Effect.void)
    const extension = Extension.union(Basic.make(), Extension.Actions(definition, definition))

    try {
      ;(EditingCore.create as Function)({ extension })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(FinalValidationError)
      expect(error).toMatchObject({
        diagnostics: [{ _tag: "DuplicateActionDefinition", action: "missingAction" }],
      })
    }
  })

  it("rejects distinct Action Tags with the same public name", () => {
    class First extends Action.Tag("duplicateAction")<First, [], void, never>() {}
    class Second extends Action.Tag("duplicateAction")<Second, [], void, never>() {}
    const extension = Extension.union(
      Basic.make(),
      Extension.Actions(
        Action.define(First, () => Effect.void),
        Action.define(Second, () => Effect.void),
      ),
    )

    try {
      ;(EditingCore.create as Function)({ extension })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(FinalValidationError)
      expect(error).toMatchObject({
        diagnostics: [{ _tag: "DuplicateActionName", action: "duplicateAction" }],
      })
    }
  })
})

const yieldResponse = (control: RewriteControl, value: string): void => {
  Effect.runSync(Deferred.succeed(control.response, value))
}
