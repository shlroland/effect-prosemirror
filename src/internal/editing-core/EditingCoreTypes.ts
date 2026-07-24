import type { Context, Layer } from "effect"
import type { Schema } from "prosemirror-model"
import type { EditorState, Transaction } from "prosemirror-state"
import type { EditorView } from "prosemirror-view"

import type { CommandDefinition, CommandTag } from "../Command.js"
import type { EditingCoreError } from "../Error.js"
import type { EditorSchemaError } from "../EditorSchema.js"
import type {
  Extension,
  MarkAttrSpec,
  NamedMarkSpec,
  NamedNodeSpec,
  NodeAttrSpec,
  UnionSpec,
} from "../Extension.js"
import type { InitialContent } from "../InitialContent.js"
import type * as Keymap from "../Keymap.js"

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

type IsAny<Value> = 0 extends 1 & Value ? true : false

type ServiceRequirements<Spec> =
  IsAny<Spec> extends true
    ? never
    : Spec extends { readonly serviceRequirement: infer Tag }
      ? Tag extends Context.Tag<infer Requirement, any>
        ? Requirement
        : never
      : Spec extends UnionSpec<infer Extensions extends readonly Extension.Any[]>
        ? ServiceRequirements<Extension.SpecOf<Extensions[number]>>
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

export type Requirements<ExtensionValue extends Extension.Any> = ServiceRequirements<
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

export interface MountedTransactionContext extends TransactionContext {
  readonly view: EditorView
}

export interface ViewBindingOptions {
  readonly getView: () => EditorView | undefined
  readonly updateState: (state: EditorState) => void
  readonly destroyView: () => void
}

export interface ViewBinding<Available extends CommandTag.Any = CommandTag.Any> {
  readonly state: EditorState
  readonly schema: Schema
  readonly commands: CommandSurface<Available>
  readonly transact: (
    callback: (context: MountedTransactionContext) => Transaction | false,
  ) => boolean
  readonly dispatchTransaction: (transaction: Transaction) => void
  readonly unmount: () => void
}

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

export type ValidatedOptions<ExtensionValue extends Extension.Any> = Options<ExtensionValue> &
  FinalValidation<ExtensionValue>

type SynchronousServiceLayer<Requirement> = [Requirement] extends [never]
  ? { readonly layer?: undefined }
  : { readonly layer: Layer.Layer<Requirement, unknown, never> }

export type CreateOptions<ExtensionValue extends Extension.Any> = ValidatedOptions<ExtensionValue> &
  SynchronousServiceLayer<Requirements<ExtensionValue>>

export type CreationError = EditingCoreError | EditorSchemaError
