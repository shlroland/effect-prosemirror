import { Context, Effect, Exit, Fiber, Scope } from "effect"
import type { Schema } from "prosemirror-model"
import { EditorState, Transaction } from "prosemirror-state"
import type { EditorView } from "prosemirror-view"

import * as Action from "../Action.js"
import type { ActionDefinition, ActionTag } from "../Action.js"
import type { CommandDefinition, CommandTag } from "../Command.js"
import {
  ActionNotAvailableError,
  ActionReentryError,
  CommandExecutionError,
  CommandNotAvailableError,
  EditorAlreadyMountedError,
  EditorDestroyedError,
  EditorDestructionError,
  EditorUnmountedError,
  EditorViewSynchronizationError,
  TransactionExecutionError,
  TransactionReentryError,
  TrackedSelectionEmptyError,
  TrackedTargetLostError,
} from "../Error.js"
import type * as Keymap from "../Keymap.js"
import type * as NodeView from "../NodeView.js"
import type {
  Any,
  ActionSurface,
  CommandSurface,
  Core,
  MountedTransactionContext,
  TransactionContext,
  Transact,
  ViewBinding,
  ViewBindingOptions,
} from "./EditingCoreTypes.js"

const ViewBindingTypeId = Symbol("effect-prosemirror/EditingCore/ViewBinding")

interface ViewBindableCore<Available extends CommandTag.Any> extends Core<Available> {
  readonly [ViewBindingTypeId]: (options: ViewBindingOptions) => ViewBinding<Available>
}

export const bindView = <Available extends CommandTag.Any>(
  core: Core<Available>,
  options: ViewBindingOptions,
): ViewBinding<Available> => (core as ViewBindableCore<Available>)[ViewBindingTypeId](options)

class CoreImpl<
  AvailableCommands extends CommandTag.Any,
  AvailableActions extends ActionTag.Any,
> implements Core<AvailableCommands, AvailableActions> {
  readonly _tag = "EditingCore"
  readonly commands: CommandSurface<AvailableCommands>
  readonly actions: ActionSurface<AvailableActions>

  readonly [ViewBindingTypeId] = (options: ViewBindingOptions): ViewBinding<AvailableCommands> =>
    this.createViewBinding(options)

  private destroyed = false
  private writing = false
  private destroyPromise: Promise<void> | undefined
  private viewBinding: ViewBindingOptions | undefined
  private readonly trackedSelections = new Set<Action.TrackedSelection>()
  private readonly subscribers = new Set<() => void>()

  constructor(
    private readonly scope: Scope.CloseableScope,
    private readonly registry: ReadonlyMap<CommandTag.Any, readonly CommandDefinition[]>,
    private readonly actionRegistry: ReadonlyMap<ActionTag.Any, ActionDefinition>,
    private readonly actionContext: Context.Context<any>,
    private readonly editorSchema: Schema,
    private editorState: EditorState,
    readonly keymap: Keymap.StaticKeymap,
    private readonly nodeViews: NodeView.Registry,
  ) {
    this.commands = {
      run: (tag, ...args) => this.run(tag, args),
      canRun: (tag, ...args) => this.canRun(tag, args),
      isActive: (tag, ...args) => this.isActive(tag, args),
    }
    this.actions = {
      run: (tag, ...args) =>
        this.runAction(tag, args) as Effect.Effect<
          ActionTag.Success<typeof tag>,
          ActionTag.Failure<typeof tag> | Action.RuntimeError,
          never
        >,
    }
  }

  get state(): EditorState {
    this.assertLive()
    return this.editorState
  }

  get schema(): Schema {
    this.assertLive()
    return this.editorSchema
  }

  readonly transact: Transact = (callback) => this.transactWithView(callback)

  subscribe(listener: () => void): () => void {
    this.assertLive()
    this.subscribers.add(listener)
    return () => {
      this.subscribers.delete(listener)
    }
  }

  destroy(): Promise<void> {
    if (this.destroyPromise) return this.destroyPromise

    this.destroyed = true
    this.subscribers.clear()
    let viewDestructionError: { readonly cause: unknown } | undefined
    try {
      this.releaseView(this.viewBinding, true)
    } catch (cause) {
      viewDestructionError = { cause }
    }

    this.destroyPromise = Effect.runPromise(Scope.close(this.scope, Exit.void)).then(
      () => {
        if (viewDestructionError) throw new EditorDestructionError(viewDestructionError)
      },
      (cause) => {
        throw new EditorDestructionError({ cause })
      },
    )
    return this.destroyPromise
  }

  private transactWithView(
    callback: (context: TransactionContext) => Transaction | false,
    view?: undefined,
  ): boolean

  private transactWithView(
    callback: (context: MountedTransactionContext) => Transaction | false,
    view: EditorView,
  ): boolean

  private transactWithView(
    callback:
      | ((context: TransactionContext) => Transaction | false)
      | ((context: MountedTransactionContext) => Transaction | false),
    view?: EditorView,
  ): boolean {
    if (this.destroyed) return false
    if (this.writing) throw new TransactionReentryError()

    this.writing = true
    try {
      let transaction: Transaction | false
      try {
        const context: TransactionContext = {
          state: this.editorState,
          schema: this.editorSchema,
          tr: this.editorState.tr,
        }
        transaction = view
          ? (callback as (context: MountedTransactionContext) => Transaction | false)({
              ...context,
              view,
            })
          : (callback as (context: TransactionContext) => Transaction | false)(context)
      } catch (cause) {
        if (cause instanceof TransactionReentryError) throw cause
        throw new TransactionExecutionError({ phase: "callback", cause })
      }

      if (transaction === false) return false
      if (!(transaction instanceof Transaction)) {
        throw new TransactionExecutionError({
          phase: "callback",
          cause: new TypeError("Transaction callback must return a Transaction or false"),
        })
      }

      try {
        return this.applyTransaction(transaction)
      } catch (cause) {
        if (
          cause instanceof TransactionExecutionError ||
          cause instanceof TransactionReentryError ||
          cause instanceof EditorViewSynchronizationError
        ) {
          throw cause
        }
        throw new TransactionExecutionError({ phase: "apply", cause })
      }
    } finally {
      this.writing = false
    }
  }

  private assertLive(): void {
    if (this.destroyed) throw new EditorDestroyedError()
  }

  private definitionsFor(tag: CommandTag.Any): readonly CommandDefinition[] {
    const definitions = this.registry.get(tag)
    if (!definitions) throw new CommandNotAvailableError({ command: tag.commandName })
    return definitions
  }

  private run(tag: CommandTag.Any, args: readonly unknown[], view?: EditorView): boolean {
    if (this.destroyed) return false
    if (this.writing) throw new TransactionReentryError()

    const definitions = this.definitionsFor(tag)
    const state = this.editorState
    this.writing = true

    try {
      for (const definition of definitions) {
        try {
          const command = definition.run(...args)
          if (command(state, (transaction) => this.applyTransaction(transaction), view)) return true
        } catch (cause) {
          if (
            cause instanceof TransactionReentryError ||
            cause instanceof EditorViewSynchronizationError
          ) {
            throw cause
          }
          throw new CommandExecutionError({
            command: tag.commandName,
            operation: "run",
            cause,
          })
        }
      }
      return false
    } finally {
      this.writing = false
    }
  }

  private canRun(tag: CommandTag.Any, args: readonly unknown[], view?: EditorView): boolean {
    if (this.destroyed) return false

    for (const definition of this.definitionsFor(tag)) {
      try {
        if (definition.run(...args)(this.editorState, undefined, view)) return true
      } catch (cause) {
        throw new CommandExecutionError({
          command: tag.commandName,
          operation: "canRun",
          cause,
        })
      }
    }
    return false
  }

  private isActive(tag: CommandTag.Any, args: readonly unknown[]): boolean {
    if (this.destroyed) return false

    for (const definition of this.definitionsFor(tag)) {
      if (!definition.isActive) continue
      try {
        if (definition.isActive(...args)(this.editorState)) return true
      } catch (cause) {
        throw new CommandExecutionError({
          command: tag.commandName,
          operation: "isActive",
          cause,
        })
      }
    }
    return false
  }

  private actionDefinitionFor(tag: ActionTag.Any): ActionDefinition {
    const definition = this.actionRegistry.get(tag)
    if (!definition) throw new ActionNotAvailableError({ action: tag.actionName })
    return definition
  }

  private runAction(
    tag: ActionTag.Any,
    args: readonly unknown[],
  ): Effect.Effect<unknown, unknown, never> {
    return Effect.suspend(() => {
      if (this.destroyed) return Effect.fail(new EditorDestroyedError())

      let definition: ActionDefinition
      try {
        definition = this.actionDefinitionFor(tag)
      } catch (error) {
        return Effect.fail(error as ActionNotAvailableError)
      }

      const runtime = this.createActionRuntime()
      let program: Effect.Effect<unknown, unknown, unknown>
      try {
        program = definition.run(...args)
      } catch (cause) {
        return Effect.fail(new ActionReentryError({ cause }))
      }

      const provided = Effect.provide(
        Effect.provideService(program, Action.ActionRuntimeContext, runtime),
        this.actionContext,
      )

      const scope = this.scope
      return Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          const fiber = yield* Effect.forkIn(restore(provided), scope)
          return yield* restore(Fiber.join(fiber)).pipe(
            Effect.onInterrupt(() => Fiber.interrupt(fiber).pipe(Effect.asVoid)),
          )
        }),
      ).pipe(Effect.ensuring(Effect.sync(runtime.release)))
    })
  }

  private createActionRuntime(): Action.ActionRuntime & { readonly release: () => void } {
    const owned = new Set<Action.TrackedSelection>()

    return {
      trackSelection: (options) =>
        Effect.suspend<
          Action.TrackedSelection,
          TrackedSelectionEmptyError | EditorDestroyedError,
          never
        >(() => {
          if (this.destroyed) return Effect.fail(new EditorDestroyedError())

          const selection = this.editorState.selection
          if (options.requireNonEmpty && selection.empty) {
            return Effect.fail(new TrackedSelectionEmptyError())
          }

          const target = Action.makeTrackedSelection({
            from: selection.from,
            to: selection.to,
            text: this.editorState.doc.textBetween(selection.from, selection.to),
          })
          owned.add(target)
          this.trackedSelections.add(target)
          return Effect.succeed(target)
        }),
      reenter: <Success, Failure>(
        target: Action.TrackedSelection,
        callback: (context: Action.ReentryContext) => Action.ReentryDecision<Success, Failure>,
      ) =>
        Effect.suspend<
          Success,
          Failure | TrackedTargetLostError | EditorDestroyedError | ActionReentryError,
          never
        >(() => {
          const state = Action.trackedSelectionState(target)
          if (this.destroyed) return Effect.fail(new EditorDestroyedError())
          if (!state.active || state.lost) return Effect.fail(new TrackedTargetLostError())
          if (this.writing) {
            return Effect.fail(new ActionReentryError({ cause: new TransactionReentryError() }))
          }

          this.writing = true
          try {
            let decision: Action.ReentryDecision<Success, Failure>
            try {
              decision = callback({
                state: this.editorState,
                schema: this.editorSchema,
                tr: this.editorState.tr,
                target: {
                  from: state.from,
                  to: state.to,
                  changed: state.changed,
                },
              })
            } catch (cause) {
              return Effect.fail(new ActionReentryError({ cause }))
            }

            if (decision._tag === "Reject") return Effect.fail(decision.error)

            try {
              this.applyTransaction(decision.transaction)
              return Effect.succeed(decision.value)
            } catch (cause) {
              return Effect.fail(new ActionReentryError({ cause }))
            }
          } finally {
            this.writing = false
          }
        }),
      release: () => {
        for (const target of owned) {
          Action.trackedSelectionState(target).active = false
          this.trackedSelections.delete(target)
        }
        owned.clear()
      },
    }
  }

  private applyTransaction(transaction: Transaction): boolean {
    const result = this.editorState.applyTransaction(transaction)
    if (result.transactions.length === 0) return false
    this.editorState = result.state
    this.mapTrackedSelections(result.transactions)

    let synchronizationError: EditorViewSynchronizationError | undefined
    const binding = this.viewBinding
    if (binding) {
      try {
        binding.updateState(result.state)
      } catch (cause) {
        try {
          this.releaseView(binding, true)
        } catch {
          // Synchronization is already unrecoverable; retain its root cause.
        }
        synchronizationError = new EditorViewSynchronizationError({ cause })
      }
    }

    this.notifySubscribers()
    if (synchronizationError) throw synchronizationError
    return true
  }

  private notifySubscribers(): void {
    const listeners = Array.from(this.subscribers)
    for (const listener of listeners) listener()
  }

  private mapTrackedSelections(transactions: readonly Transaction[]): void {
    for (const transaction of transactions) {
      for (const target of this.trackedSelections) {
        const state = Action.trackedSelectionState(target)
        if (!state.active || state.lost) continue

        for (const step of transaction.steps) {
          const map = step.getMap()
          const from = state.from
          const to = state.to

          map.forEach((oldStart, oldEnd) => {
            if (oldStart === oldEnd) {
              if (oldStart > from && oldStart < to) state.changed = true
              return
            }

            if (oldStart < to && oldEnd > from) {
              state.changed = true
              if (oldStart <= from && oldEnd >= to) state.lost = true
            }
          })

          const mappedFrom = map.mapResult(from, 1)
          const mappedTo = map.mapResult(to, -1)
          state.from = mappedFrom.pos
          state.to = mappedTo.pos
        }
      }
    }
  }

  private createViewBinding(options: ViewBindingOptions): ViewBinding<AvailableCommands> {
    this.assertLive()
    if (this.viewBinding) throw new EditorAlreadyMountedError()

    this.viewBinding = options
    const coreState = (): EditorState => this.state
    const coreSchema = (): Schema => this.schema

    const view = (): EditorView => {
      const current = options.getView()
      if (!current) throw new EditorUnmountedError()
      return current
    }

    return {
      get state() {
        return coreState()
      },
      get schema() {
        return coreSchema()
      },
      commands: {
        run: (tag, ...args) => this.run(tag, args, view()),
        canRun: (tag, ...args) => this.canRun(tag, args, view()),
        isActive: (tag, ...args) => this.isActive(tag, args),
      },
      nodeViews: this.nodeViews,
      transact: (callback) => this.transactWithView(callback, view()),
      dispatchTransaction: (transaction) => {
        if (this.destroyed) return
        if (this.writing) throw new TransactionReentryError()

        this.writing = true
        try {
          this.applyTransaction(transaction)
        } catch (cause) {
          if (
            cause instanceof TransactionReentryError ||
            cause instanceof EditorViewSynchronizationError
          ) {
            throw cause
          }
          throw new TransactionExecutionError({ phase: "apply", cause })
        } finally {
          this.writing = false
        }
      },
      unmount: () => this.releaseView(options, true),
    }
  }

  private releaseView(options: ViewBindingOptions | undefined, destroy: boolean): void {
    if (!options || this.viewBinding !== options) return
    this.viewBinding = undefined
    if (destroy) options.destroyView()
  }
}

export const make = (
  scope: Scope.CloseableScope,
  registry: ReadonlyMap<CommandTag.Any, readonly CommandDefinition[]>,
  actionRegistry: ReadonlyMap<ActionTag.Any, ActionDefinition>,
  actionContext: Context.Context<any>,
  schema: Schema,
  state: EditorState,
  keymap: Keymap.StaticKeymap,
  nodeViews: NodeView.Registry,
): Any =>
  new CoreImpl(scope, registry, actionRegistry, actionContext, schema, state, keymap, nodeViews)
