import { Effect, Exit, Scope } from "effect"
import type { Schema } from "prosemirror-model"
import { EditorState, Transaction } from "prosemirror-state"
import type { EditorView } from "prosemirror-view"

import type { CommandDefinition, CommandTag } from "../Command.js"
import {
  CommandExecutionError,
  CommandNotAvailableError,
  EditorAlreadyMountedError,
  EditorDestroyedError,
  EditorDestructionError,
  EditorUnmountedError,
  EditorViewSynchronizationError,
  TransactionExecutionError,
  TransactionReentryError,
} from "../Error.js"
import type * as Keymap from "../Keymap.js"
import type {
  Any,
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

class CoreImpl<Available extends CommandTag.Any> implements Core<Available> {
  readonly _tag = "EditingCore"
  readonly commands: CommandSurface<Available>

  readonly [ViewBindingTypeId] = (options: ViewBindingOptions): ViewBinding<Available> =>
    this.createViewBinding(options)

  private destroyed = false
  private writing = false
  private destroyPromise: Promise<void> | undefined
  private viewBinding: ViewBindingOptions | undefined

  constructor(
    private readonly scope: Scope.CloseableScope,
    private readonly registry: ReadonlyMap<CommandTag.Any, readonly CommandDefinition[]>,
    private readonly editorSchema: Schema,
    private editorState: EditorState,
    readonly keymap: Keymap.StaticKeymap,
  ) {
    this.commands = {
      run: (tag, ...args) => this.run(tag, args),
      canRun: (tag, ...args) => this.canRun(tag, args),
      isActive: (tag, ...args) => this.isActive(tag, args),
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

  destroy(): Promise<void> {
    if (this.destroyPromise) return this.destroyPromise

    this.destroyed = true
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

  private applyTransaction(transaction: Transaction): boolean {
    const result = this.editorState.applyTransaction(transaction)
    if (result.transactions.length === 0) return false
    this.editorState = result.state

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
        throw new EditorViewSynchronizationError({ cause })
      }
    }

    return true
  }

  private createViewBinding(options: ViewBindingOptions): ViewBinding<Available> {
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
      transact: (callback) => this.transactWithView(callback, view()),
      dispatchTransaction: (transaction) => {
        if (this.destroyed) return
        if (this.writing) throw new TransactionReentryError()

        this.writing = true
        try {
          this.applyTransaction(transaction)
        } catch (cause) {
          if (cause instanceof EditorViewSynchronizationError) throw cause
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
  schema: Schema,
  state: EditorState,
  keymap: Keymap.StaticKeymap,
): Any => new CoreImpl(scope, registry, schema, state, keymap)
