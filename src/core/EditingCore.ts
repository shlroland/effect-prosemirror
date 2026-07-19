import { Context, Effect, Exit, Layer, Scope } from "effect"
import {
  DOMParser as ProseMirrorDOMParser,
  Node as ProseMirrorNode,
  type Schema,
} from "prosemirror-model"
import { EditorState, Transaction } from "prosemirror-state"

import type { CommandDefinition, CommandTag } from "./Command.js"
import * as EditorSchema from "./EditorSchema.js"
import {
  CommandExecutionError,
  CommandNotAvailableError,
  EditorDestroyedError,
  EditorDestructionError,
  FinalValidationError,
  InitialContentCreationError,
  InitialContentDocumentUnavailableError,
  InvalidInitialContentError,
  TransactionExecutionError,
  TransactionReentryError,
  type EditingCoreError,
  type FinalValidationDiagnostic,
} from "./Error.js"
import type {
  Contribution,
  Extension,
  MarkAttrSpec,
  NamedMarkSpec,
  NamedNodeSpec,
  NodeAttrSpec,
  UnionSpec,
} from "./Extension.js"
import type { InitialContent } from "./InitialContent.js"
import * as Keymap from "./Keymap.js"
import { Priority, type Priority as PriorityValue } from "./Priority.js"

export interface Diagnostic<Message extends string, Detail> {
  readonly __effectProsemirrorError: Message
  readonly detail: Detail
}

type NodeSpecNames<Spec> = Spec extends { readonly nodeSpec: infer Node }
  ? Node extends NamedNodeSpec
    ? Node["name"]
    : never
  : Spec extends UnionSpec<infer Extensions extends readonly Extension.Any[]>
    ? NodeSpecNames<Extension.SpecOf<Extensions[number]>>
    : never

type MarkSpecNames<Spec> = Spec extends { readonly markSpec: infer Mark }
  ? Mark extends NamedMarkSpec
    ? Mark["name"]
    : never
  : Spec extends UnionSpec<infer Extensions extends readonly Extension.Any[]>
    ? MarkSpecNames<Extension.SpecOf<Extensions[number]>>
    : never

type NodeAttrs<Spec> = Spec extends { readonly nodeAttr: infer Attr }
  ? Attr extends NodeAttrSpec
    ? Attr
    : never
  : Spec extends UnionSpec<infer Extensions extends readonly Extension.Any[]>
    ? NodeAttrs<Extension.SpecOf<Extensions[number]>>
    : never

type MarkAttrs<Spec> = Spec extends { readonly markAttr: infer Attr }
  ? Attr extends MarkAttrSpec
    ? Attr
    : never
  : Spec extends UnionSpec<infer Extensions extends readonly Extension.Any[]>
    ? MarkAttrs<Extension.SpecOf<Extensions[number]>>
    : never

type CommandDefinitions<Spec> = Spec extends {
  readonly commandDefinitions: infer Definitions
}
  ? Definitions extends readonly CommandDefinition[]
    ? Definitions[number]
    : never
  : Spec extends UnionSpec<infer Extensions extends readonly Extension.Any[]>
    ? CommandDefinitions<Extension.SpecOf<Extensions[number]>>
    : never

type KeyBindings<Spec> = Spec extends { readonly keyBindings: infer Bindings }
  ? Bindings extends readonly unknown[]
    ? Bindings[number]
    : never
  : Spec extends UnionSpec<infer Extensions extends readonly Extension.Any[]>
    ? KeyBindings<Extension.SpecOf<Extensions[number]>>
    : never

type ImplementedCommandTags<Spec, Definition = CommandDefinitions<Spec>> = [Definition] extends [
  never,
]
  ? never
  : Definition extends CommandDefinition<infer Tag>
    ? Tag
    : never

type InvokedCommandTags<Spec> = [KeyBindings<Spec>] extends [never]
  ? never
  : KeyBindings<Spec> extends infer Binding
    ? Binding extends { readonly invocation: { readonly tag: infer Tag } }
      ? Tag extends CommandTag.Any
        ? Tag
        : never
      : never
    : never

type MissingNodeTargetDiagnostics<Spec> =
  NodeAttrs<Spec> extends infer Attr
    ? Attr extends NodeAttrSpec
      ? Attr["type"] extends NodeSpecNames<Spec>
        ? never
        : Diagnostic<
            "MissingNodeTarget",
            {
              readonly type: Attr["type"]
              readonly attr: Attr["attr"]
            }
          >
      : never
    : never

type MissingMarkTargetDiagnostics<Spec> =
  MarkAttrs<Spec> extends infer Attr
    ? Attr extends MarkAttrSpec
      ? Attr["type"] extends MarkSpecNames<Spec>
        ? never
        : Diagnostic<
            "MissingMarkTarget",
            {
              readonly type: Attr["type"]
              readonly attr: Attr["attr"]
            }
          >
      : never
    : never

type MissingCommandImplementationDiagnostics<
  Spec,
  Tag = InvokedCommandTags<Spec>,
> = Tag extends CommandTag.Any
  ? Tag extends ImplementedCommandTags<Spec>
    ? never
    : Diagnostic<"MissingCommandImplementation", { readonly command: CommandTag.Name<Tag> }>
  : never

type FinalValidationDiagnostics<ExtensionValue extends Extension.Any> =
  | MissingNodeTargetDiagnostics<Extension.SpecOf<ExtensionValue>>
  | MissingMarkTargetDiagnostics<Extension.SpecOf<ExtensionValue>>
  | MissingCommandImplementationDiagnostics<Extension.SpecOf<ExtensionValue>>

export type FinalValidation<ExtensionValue extends Extension.Any> = [
  FinalValidationDiagnostics<ExtensionValue>,
] extends [never]
  ? unknown
  : { readonly extension: FinalValidationDiagnostics<ExtensionValue> }

export type AvailableCommandTags<ExtensionValue extends Extension.Any> = ImplementedCommandTags<
  Extension.SpecOf<ExtensionValue>
>

export interface CommandSurface<Available extends CommandTag.Any> {
  readonly run: <Tag extends Available>(tag: Tag, ...args: CommandTag.Args<Tag>) => boolean
  readonly canRun: <Tag extends Available>(tag: Tag, ...args: CommandTag.Args<Tag>) => boolean
  readonly isActive: <Tag extends Available>(tag: Tag, ...args: CommandTag.Args<Tag>) => boolean
}

export interface TransactionContext {
  readonly state: EditorState
  readonly schema: Schema
  readonly tr: Transaction
}

export type Transact = (callback: (context: TransactionContext) => Transaction | false) => boolean

export interface Core<Available extends CommandTag.Any = CommandTag.Any> {
  readonly _tag: "EditingCore"
  readonly state: EditorState
  readonly schema: Schema
  readonly commands: CommandSurface<Available>
  readonly keymap: Keymap.StaticKeymap
  readonly transact: Transact
  readonly destroy: () => Promise<void>
}

export type Any = Core<CommandTag.Any>

export interface Options<ExtensionValue extends Extension.Any = Extension.Any> {
  readonly extension: ExtensionValue
  readonly initialContent?: InitialContent
}

type ValidatedOptions<ExtensionValue extends Extension.Any> = Options<ExtensionValue> &
  FinalValidation<ExtensionValue>

export type CreationError = EditingCoreError | EditorSchema.EditorSchemaError

const priorityRank: Record<PriorityValue, number> = {
  [Priority.Lowest]: 0,
  [Priority.Low]: 1,
  [Priority.Default]: 2,
  [Priority.High]: 3,
  [Priority.Highest]: 4,
}

interface IndexedDefinition {
  readonly definition: CommandDefinition
  readonly priority: PriorityValue
  readonly index: number
}

const isCommandContribution = (
  contribution: Contribution,
): contribution is Contribution<"command.definitions", readonly CommandDefinition[]> =>
  contribution.type === "command.definitions"

const collectDefinitions = (extension: Extension.Any): readonly IndexedDefinition[] => {
  const definitions: IndexedDefinition[] = []
  let index = 0

  for (const contribution of extension.contributions) {
    if (!isCommandContribution(contribution)) continue

    for (const definition of contribution.payload) {
      definitions.push({ definition, priority: contribution.priority, index })
      index += 1
    }
  }

  return definitions.sort((left, right) => {
    const priorityDifference = priorityRank[right.priority] - priorityRank[left.priority]
    return priorityDifference === 0 ? left.index - right.index : priorityDifference
  })
}

const collectRuntimeDiagnostics = (
  extension: Extension.Any,
  definitions: readonly IndexedDefinition[],
  keymap: Keymap.StaticKeymap,
): readonly FinalValidationDiagnostic[] => {
  const diagnostics: FinalValidationDiagnostic[] = [...EditorSchema.collect(extension).diagnostics]
  const commandTagsByName = new Map<string, CommandTag.Any>()
  const duplicateNames = new Set<string>()
  const implementedTags = new Set(definitions.map(({ definition }) => definition.tag))
  const allTags = [
    ...definitions.map(({ definition }) => definition.tag),
    ...keymap.bindings.map(({ invocation }) => invocation.tag),
  ]

  for (const tag of allTags) {
    const existing = commandTagsByName.get(tag.commandName)

    if (!existing) {
      commandTagsByName.set(tag.commandName, tag)
    } else if (existing !== tag) {
      duplicateNames.add(tag.commandName)
    }
  }

  for (const command of duplicateNames) {
    diagnostics.push({ _tag: "DuplicateCommandName", command })
  }

  const missingTags = new Set<CommandTag.Any>()
  for (const { invocation } of keymap.bindings) {
    if (!implementedTags.has(invocation.tag)) missingTags.add(invocation.tag)
  }
  for (const tag of missingTags) {
    diagnostics.push({ _tag: "MissingCommandImplementation", command: tag.commandName })
  }

  return diagnostics
}

const buildRegistry = (
  definitions: readonly IndexedDefinition[],
): ReadonlyMap<CommandTag.Any, readonly CommandDefinition[]> => {
  const registry = new Map<CommandTag.Any, CommandDefinition[]>()

  for (const { definition } of definitions) {
    const chain = registry.get(definition.tag)
    if (chain) chain.push(definition)
    else registry.set(definition.tag, [definition])
  }

  return registry
}

const invalidContent = (
  source: "Node" | "JSON" | "HTML",
  cause: unknown,
): InvalidInitialContentError =>
  new InvalidInitialContentError({ source, reason: "InvalidDocument", cause })

const validateDocument = (
  schema: Schema,
  node: ProseMirrorNode,
  source: "Node" | "JSON" | "HTML",
): ProseMirrorNode => {
  if (node.type.schema !== schema) {
    throw new InvalidInitialContentError({ source, reason: "SchemaMismatch" })
  }

  try {
    if (node.type !== schema.topNodeType) {
      throw new RangeError(`Expected top node ${schema.topNodeType.name}, got ${node.type.name}`)
    }
    node.check()
    return node
  } catch (cause) {
    if (cause instanceof InvalidInitialContentError) throw cause
    throw invalidContent(source, cause)
  }
}

const createDocument = (schema: Schema, initialContent?: InitialContent): ProseMirrorNode => {
  if (!initialContent) {
    const node = schema.topNodeType.createAndFill()
    if (!node) {
      throw new InitialContentCreationError({ reason: "TopNodeCannotCreateAndFill" })
    }
    return node
  }

  switch (initialContent._tag) {
    case "Node":
      return validateDocument(schema, initialContent.node, "Node")
    case "JSON":
      try {
        return validateDocument(
          schema,
          ProseMirrorNode.fromJSON(schema, initialContent.json),
          "JSON",
        )
      } catch (cause) {
        if (cause instanceof InvalidInitialContentError) throw cause
        throw invalidContent("JSON", cause)
      }
    case "HTML": {
      if (typeof document === "undefined") {
        throw new InitialContentDocumentUnavailableError()
      }

      try {
        const container = document.createElement("div")
        container.innerHTML = initialContent.html
        const node = ProseMirrorDOMParser.fromSchema(schema).parse(container)
        return validateDocument(schema, node, "HTML")
      } catch (cause) {
        if (cause instanceof InvalidInitialContentError) throw cause
        throw invalidContent("HTML", cause)
      }
    }
  }
}

class CoreImpl<Available extends CommandTag.Any> implements Core<Available> {
  readonly _tag = "EditingCore"
  readonly commands: CommandSurface<Available>

  private destroyed = false
  private writing = false
  private destroyPromise: Promise<void> | undefined

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

  readonly transact: Transact = (callback) => {
    if (this.destroyed) return false
    if (this.writing) throw new TransactionReentryError()

    this.writing = true
    try {
      let transaction: Transaction | false
      try {
        transaction = callback({
          state: this.editorState,
          schema: this.editorSchema,
          tr: this.editorState.tr,
        })
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
        if (cause instanceof TransactionExecutionError) throw cause
        throw new TransactionExecutionError({ phase: "apply", cause })
      }
    } finally {
      this.writing = false
    }
  }

  destroy(): Promise<void> {
    if (this.destroyPromise) return this.destroyPromise

    this.destroyed = true
    this.destroyPromise = Effect.runPromise(Scope.close(this.scope, Exit.void)).catch((cause) => {
      throw new EditorDestructionError({ cause })
    })
    return this.destroyPromise
  }

  private assertLive(): void {
    if (this.destroyed) throw new EditorDestroyedError()
  }

  private definitionsFor(tag: CommandTag.Any): readonly CommandDefinition[] {
    const definitions = this.registry.get(tag)
    if (!definitions) throw new CommandNotAvailableError({ command: tag.commandName })
    return definitions
  }

  private run(tag: CommandTag.Any, args: readonly unknown[]): boolean {
    if (this.destroyed) return false
    if (this.writing) throw new TransactionReentryError()

    const definitions = this.definitionsFor(tag)
    const state = this.editorState
    this.writing = true

    try {
      for (const definition of definitions) {
        try {
          const command = definition.run(...args)
          if (command(state, (transaction) => this.applyTransaction(transaction))) return true
        } catch (cause) {
          if (cause instanceof TransactionReentryError) throw cause
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

  private canRun(tag: CommandTag.Any, args: readonly unknown[]): boolean {
    if (this.destroyed) return false

    for (const definition of this.definitionsFor(tag)) {
      try {
        if (definition.run(...args)(this.editorState)) return true
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
    return true
  }
}

const buildCore = (options: Options, scope: Scope.CloseableScope): Any => {
  const definitions = collectDefinitions(options.extension)
  const keymap = Keymap.collect(options.extension)
  const diagnostics = collectRuntimeDiagnostics(options.extension, definitions, keymap)
  if (diagnostics.length > 0) throw new FinalValidationError({ diagnostics })

  const schema = EditorSchema.create(options.extension)
  const doc = createDocument(schema, options.initialContent)

  let state: EditorState
  try {
    state = EditorState.create({ schema, doc })
  } catch (cause) {
    throw invalidContent(options.initialContent?._tag ?? "Node", cause)
  }

  return new CoreImpl(scope, buildRegistry(definitions), schema, state, keymap)
}

export class EditingCore extends Context.Tag("effect-prosemirror/EditingCore")<EditingCore, Any>() {
  static make<const ExtensionValue extends Extension.Any>(
    options: ValidatedOptions<ExtensionValue>,
  ): Effect.Effect<Core<AvailableCommandTags<ExtensionValue>>, CreationError, Scope.Scope> {
    return (make as Function)(options) as Effect.Effect<
      Core<AvailableCommandTags<ExtensionValue>>,
      CreationError,
      Scope.Scope
    >
  }

  static layer<const ExtensionValue extends Extension.Any>(
    options: ValidatedOptions<ExtensionValue>,
  ): Layer.Layer<EditingCore, CreationError> {
    return (layer as Function)(options) as Layer.Layer<EditingCore, CreationError>
  }

  static create<const ExtensionValue extends Extension.Any>(
    options: ValidatedOptions<ExtensionValue>,
  ): Core<AvailableCommandTags<ExtensionValue>> {
    return (create as Function)(options) as Core<AvailableCommandTags<ExtensionValue>>
  }
}

export const make = <const ExtensionValue extends Extension.Any>(
  options: ValidatedOptions<ExtensionValue>,
): Effect.Effect<Core<AvailableCommandTags<ExtensionValue>>, CreationError, Scope.Scope> =>
  Effect.gen(function* () {
    const scope = yield* Scope.make()
    const core = yield* Effect.try({
      try: () => buildCore(options, scope),
      catch: (error) => error as CreationError,
    }).pipe(Effect.tapError(() => Scope.close(scope, Exit.void)))

    yield* Effect.addFinalizer(() => Effect.promise(() => core.destroy()))
    return core as Core<AvailableCommandTags<ExtensionValue>>
  })

export const layer = <const ExtensionValue extends Extension.Any>(
  options: ValidatedOptions<ExtensionValue>,
): Layer.Layer<EditingCore, CreationError> =>
  Layer.scoped(
    EditingCore,
    (make as Function)(options) as Effect.Effect<Any, CreationError, Scope.Scope>,
  )

export const create = <const ExtensionValue extends Extension.Any>(
  options: ValidatedOptions<ExtensionValue>,
): Core<AvailableCommandTags<ExtensionValue>> => {
  const scope = Effect.runSync(Scope.make())
  try {
    return buildCore(options, scope) as Core<AvailableCommandTags<ExtensionValue>>
  } catch (error) {
    void Effect.runPromise(Scope.close(scope, Exit.void))
    throw error
  }
}
