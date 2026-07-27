import { Context, Data, Effect, Layer } from "effect"
import { expectTypeOf } from "expect-type"

import { Action, EditingCore, Extension } from "../../src/core.js"

interface RewriteResult {
  readonly replacement: string
}

class RewriteError extends Data.TaggedError("RewriteError")<{}> {}

class Rewriter extends Context.Tag("test/Rewriter")<
  Rewriter,
  {
    readonly rewrite: (input: string) => Effect.Effect<string, RewriteError>
  }
>() {}

class RewriteSelection extends Action.Tag("rewriteSelection")<
  RewriteSelection,
  [instruction: string],
  RewriteResult,
  RewriteError
>() {}

class MissingAction extends Action.Tag("missingAction")<MissingAction, [], void, never>() {}

const rewriteSelection = Action.define(
  RewriteSelection,
  (instruction): Effect.Effect<RewriteResult, RewriteError, Rewriter> =>
    Effect.gen(function* () {
      const rewriter = yield* Rewriter
      const replacement = yield* rewriter.rewrite(instruction)
      return { replacement }
    }),
)

expectTypeOf(rewriteSelection.tag).toEqualTypeOf<typeof RewriteSelection>()
expectTypeOf(rewriteSelection.run).parameters.toEqualTypeOf<[instruction: string]>()
expectTypeOf<Action.ActionTag.Args<typeof RewriteSelection>>().toEqualTypeOf<
  [instruction: string]
>()
expectTypeOf<Action.ActionTag.Success<typeof RewriteSelection>>().toEqualTypeOf<RewriteResult>()
expectTypeOf<Action.ActionTag.Failure<typeof RewriteSelection>>().toEqualTypeOf<RewriteError>()
expectTypeOf<Action.Definition.Requirements<typeof rewriteSelection>>().toEqualTypeOf<Rewriter>()

const actionExtension = Extension.Actions(rewriteSelection)

expectTypeOf(actionExtension.spec.actionDefinitions).toEqualTypeOf<
  readonly [typeof rewriteSelection]
>()

const schema = Extension.union(
  Extension.NodeSpec({ name: "doc", content: "paragraph+" }),
  Extension.NodeSpec({ name: "paragraph", content: "text*" }),
  Extension.NodeSpec({ name: "text" }),
)
const extension = Extension.union(schema, actionExtension)

expectTypeOf<EditingCore.Requirements<typeof extension>>().toEqualTypeOf<Rewriter>()
expectTypeOf<EditingCore.AvailableActionTags<typeof extension>>().toEqualTypeOf<
  typeof RewriteSelection
>()

const duplicateDefinition = Extension.union(
  schema,
  Extension.Actions(rewriteSelection, rewriteSelection),
)
expectTypeOf<EditingCore.FinalValidation<typeof duplicateDefinition>>().toEqualTypeOf<{
  readonly extension: EditingCore.Diagnostic<
    "DuplicateActionDefinition",
    { readonly action: "rewriteSelection" }
  >
}>()

const rewriterLive = Layer.succeed(Rewriter, {
  rewrite: (input) => Effect.succeed(input),
})
const core = EditingCore.create({ extension, layer: rewriterLive })
const program = core.actions.run(RewriteSelection, "shorter")

expectTypeOf(program).toEqualTypeOf<
  Effect.Effect<RewriteResult, RewriteError | Action.RuntimeError, never>
>()

// @ts-expect-error Action arguments are inferred from the selected Tag.
core.actions.run(RewriteSelection, 1)

// @ts-expect-error The current Editing Core does not implement this Action Tag.
core.actions.run(MissingAction)

Action.define(
  RewriteSelection,
  // @ts-expect-error Action Definition arguments must match the Action Tag.
  (instruction: number) => Effect.succeed({ replacement: String(instruction) }),
)

Action.define(
  RewriteSelection,
  // @ts-expect-error Action Definition success must match the Action Tag.
  () => Effect.succeed({ replacement: 1 }),
)

Action.define(
  RewriteSelection,
  // @ts-expect-error Action Definition failure must match the Action Tag.
  () => Effect.fail("failed"),
)
