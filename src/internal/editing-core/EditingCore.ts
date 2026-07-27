import { Context, Effect, Exit, Layer, Scope } from "effect"
import { EditorState } from "prosemirror-state"

import * as Compilation from "./EditingCoreCompilation.js"
import * as Runtime from "./EditingCoreRuntime.js"
import type {
  Any,
  AvailableActionTags,
  AvailableCommandTags,
  Core,
  CreateOptions,
  CreationError,
  Options,
  Requirements,
  ValidatedOptions,
} from "./EditingCoreTypes.js"
import { InvalidInitialContentError } from "../Error.js"
import * as EditorSchema from "../EditorSchema.js"
import type { Extension } from "../Extension.js"
import * as InitialDocument from "./InitialDocument.js"

export type {
  Any,
  AvailableActionTags,
  AvailableCommandTags,
  ActionSurface,
  CommandSurface,
  Core,
  CreateOptions,
  CreationError,
  Diagnostic,
  FinalValidation,
  MountedTransactionContext,
  Options,
  Requirements,
  TransactionContext,
  Transact,
  ViewBinding,
  ViewBindingOptions,
} from "./EditingCoreTypes.js"

/** @internal */
export const bindView = Runtime.bindView

const buildCore = (
  options: Options,
  scope: Scope.CloseableScope,
  actionContext: Context.Context<any>,
): Any => {
  const compiled = Compilation.compile(options.extension)
  const schema = EditorSchema.create(options.extension)
  const doc = InitialDocument.create(schema, options.initialContent)

  let state: EditorState
  try {
    state = EditorState.create({ schema, doc })
  } catch (cause) {
    throw new InvalidInitialContentError({
      source: options.initialContent?._tag ?? "Node",
      reason: "InvalidDocument",
      cause,
    })
  }

  return Runtime.make(
    scope,
    compiled.registry,
    compiled.actionRegistry,
    actionContext,
    schema,
    state,
    compiled.keymap,
  )
}

export class EditingCore extends Context.Tag("effect-prosemirror/EditingCore")<EditingCore, Any>() {
  static make<const ExtensionValue extends Extension.Any>(
    options: ValidatedOptions<ExtensionValue>,
  ): Effect.Effect<
    Core<AvailableCommandTags<ExtensionValue>, AvailableActionTags<ExtensionValue>>,
    CreationError,
    Requirements<ExtensionValue> | Scope.Scope
  > {
    return (make as Function)(options) as Effect.Effect<
      Core<AvailableCommandTags<ExtensionValue>, AvailableActionTags<ExtensionValue>>,
      CreationError,
      Requirements<ExtensionValue> | Scope.Scope
    >
  }

  static layer<const ExtensionValue extends Extension.Any>(
    options: ValidatedOptions<ExtensionValue>,
  ): Layer.Layer<EditingCore, CreationError, Requirements<ExtensionValue>> {
    return (layer as Function)(options) as Layer.Layer<
      EditingCore,
      CreationError,
      Requirements<ExtensionValue>
    >
  }

  static create<const ExtensionValue extends Extension.Any>(
    options: CreateOptions<ExtensionValue>,
  ): Core<AvailableCommandTags<ExtensionValue>, AvailableActionTags<ExtensionValue>> {
    return (create as Function)(options) as Core<
      AvailableCommandTags<ExtensionValue>,
      AvailableActionTags<ExtensionValue>
    >
  }
}

const makeInternal = (options: Options): Effect.Effect<Any, CreationError, Scope.Scope> =>
  Effect.gen(function* () {
    const scope = yield* Scope.make()
    const actionContext = yield* Effect.context<any>()
    const core = yield* Compilation.validateServiceRequirements<any>(options.extension).pipe(
      Effect.zipRight(
        Effect.try({
          try: () => buildCore(options, scope, actionContext),
          catch: (error) => error as CreationError,
        }),
      ),
      Effect.tapError(() => Scope.close(scope, Exit.void)),
    )

    yield* Effect.addFinalizer(() => Effect.promise(() => core.destroy()))
    return core
  })

export const make = <const ExtensionValue extends Extension.Any>(
  options: ValidatedOptions<ExtensionValue>,
): Effect.Effect<
  Core<AvailableCommandTags<ExtensionValue>, AvailableActionTags<ExtensionValue>>,
  CreationError,
  Requirements<ExtensionValue> | Scope.Scope
> =>
  (makeInternal as Function)(options) as Effect.Effect<
    Core<AvailableCommandTags<ExtensionValue>, AvailableActionTags<ExtensionValue>>,
    CreationError,
    Requirements<ExtensionValue> | Scope.Scope
  >

export const layer = <const ExtensionValue extends Extension.Any>(
  options: ValidatedOptions<ExtensionValue>,
): Layer.Layer<EditingCore, CreationError, Requirements<ExtensionValue>> =>
  Layer.scoped(
    EditingCore,
    (make as Function)(options) as Effect.Effect<Any, CreationError, Scope.Scope>,
  )

export const create = <const ExtensionValue extends Extension.Any>(
  options: CreateOptions<ExtensionValue>,
): Core<AvailableCommandTags<ExtensionValue>, AvailableActionTags<ExtensionValue>> => {
  const scope = Effect.runSync(Scope.make())
  try {
    const actionContext = Compilation.buildSynchronousServiceContext(
      options.extension,
      scope,
      "layer" in options ? options.layer : undefined,
    )
    return buildCore(options, scope, actionContext) as Core<
      AvailableCommandTags<ExtensionValue>,
      AvailableActionTags<ExtensionValue>
    >
  } catch (error) {
    void Effect.runPromise(Scope.close(scope, Exit.void))
    throw error
  }
}
