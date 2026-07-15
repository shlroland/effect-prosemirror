import { Context, Effect, Layer } from "effect"

import { EditorDestroyedError } from "./Error.js"
import type {
  Extension,
  MarkAttrSpec,
  NamedMarkSpec,
  NamedNodeSpec,
  NodeAttrSpec,
  UnionSpec,
} from "./Extension.js"

export interface EditorService {
  readonly _tag: "EditorService"
}

export const EditorService = Context.GenericTag<EditorService>("effect-prosemirror/EditorService")

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

type FinalValidationDiagnostics<ExtensionValue extends Extension.Any> =
  | MissingNodeTargetDiagnostics<Extension.SpecOf<ExtensionValue>>
  | MissingMarkTargetDiagnostics<Extension.SpecOf<ExtensionValue>>

export type FinalValidation<ExtensionValue extends Extension.Any> = [
  FinalValidationDiagnostics<ExtensionValue>,
] extends [never]
  ? unknown
  : { readonly extension: FinalValidationDiagnostics<ExtensionValue> }

export interface EditorOptions<ExtensionValue extends Extension.Any = Extension.Any> {
  readonly extension: ExtensionValue
  readonly element?: Element
}

type ValidatedEditorOptions<ExtensionValue extends Extension.Any> = EditorOptions<ExtensionValue> &
  FinalValidation<ExtensionValue>

const makeService = (): EditorService => ({ _tag: "EditorService" })

export const layer = <const ExtensionValue extends Extension.Any>(
  _options: ValidatedEditorOptions<ExtensionValue>,
): Layer.Layer<EditorService, EditorDestroyedError> =>
  Layer.effect(EditorService, Effect.succeed(makeService()))

export const make = <const ExtensionValue extends Extension.Any>(
  _options: ValidatedEditorOptions<ExtensionValue>,
): Effect.Effect<EditorService, EditorDestroyedError> => Effect.succeed(makeService())

export const createEditor = <const ExtensionValue extends Extension.Any>(
  _options: ValidatedEditorOptions<ExtensionValue>,
): EditorService & { destroy(): void } => ({
  _tag: "EditorService",
  destroy() {},
})
