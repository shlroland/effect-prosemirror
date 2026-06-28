import { pipeArguments, type Pipeable } from "effect/Pipeable"
import type {
  AttributeSpec,
  MarkSpec as ProseMirrorMarkSpec,
  NodeSpec as ProseMirrorNodeSpec,
} from "prosemirror-model"

import { Default, type Priority } from "./Priority.js"

export interface Contribution<Type extends string = string, Payload = unknown> {
  readonly type: Type
  readonly payload: Payload
  readonly priority: Priority
}

export interface Extension<Spec = unknown> extends Pipeable {
  readonly _tag: "Extension"
  readonly spec: Spec
  readonly contributions: readonly Contribution[]
}

export namespace Extension {
  export type Any = Extension<any>
  export type SpecOf<T> = T extends Extension<infer Spec> ? Spec : never
}

export type UnionSpec<Extensions extends readonly Extension.Any[]> = {
  readonly extensions: Extensions
}

export type UnionOperator<Extensions extends readonly Extension.Any[]> = Extension<UnionSpec<Extensions>> & {
  <Self extends Extension.Any>(self: Self): Extension<UnionSpec<readonly [Self, ...Extensions]>>
}

export interface NamedNodeSpec<Name extends string = string> extends ProseMirrorNodeSpec {
  readonly name: Name
}

export interface NamedMarkSpec<Name extends string = string> extends ProseMirrorMarkSpec {
  readonly name: Name
}

export interface NodeAttrSpec<Type extends string = string, Attr extends string = string> {
  readonly type: Type
  readonly attr: Attr
  readonly spec: AttributeSpec
}

export interface MarkAttrSpec<Type extends string = string, Attr extends string = string> {
  readonly type: Type
  readonly attr: Attr
  readonly spec: AttributeSpec
}

class ExtensionImpl<Spec> implements Extension<Spec> {
  readonly _tag = "Extension"

  constructor(
    readonly spec: Spec,
    readonly contributions: readonly Contribution[],
  ) {}

  pipe() {
    return pipeArguments(this, arguments)
  }
}

const make = <Spec>(
  spec: Spec,
  contributions: readonly Contribution[] = [],
): Extension<Spec> => new ExtensionImpl(spec, contributions)

export const contribution = <const Type extends string, const Payload>(type: Type, payload: Payload): Extension<{
  readonly contribution: Contribution<Type, Payload>
}> =>
  make(
    { contribution: { type, payload, priority: Default } },
    [{ type, payload, priority: Default }],
  )

export const union = <const Extensions extends readonly Extension.Any[]>(
  ...extensions: Extensions
): UnionOperator<Extensions> => {
  const operator = (<Self extends Extension.Any>(self: Self) =>
    union(self, ...extensions)) as unknown as UnionOperator<Extensions>

  Object.defineProperties(operator, {
    _tag: { value: "Extension", enumerable: true },
    spec: { value: { extensions }, enumerable: true },
    contributions: {
      value: extensions.flatMap((extension) => [...extension.contributions]),
      enumerable: true,
    },
    pipe: {
      value() {
        return pipeArguments(this, arguments)
      },
      enumerable: true,
    },
  })

  return operator
}

export const NodeSpec = <const Spec extends NamedNodeSpec>(spec: Spec): Extension<{
  readonly nodeSpec: Spec
}> =>
  make(
    { nodeSpec: spec },
    [{ type: "schema.nodeSpec", payload: spec, priority: Default }],
  )

export const MarkSpec = <const Spec extends NamedMarkSpec>(spec: Spec): Extension<{
  readonly markSpec: Spec
}> =>
  make(
    { markSpec: spec },
    [{ type: "schema.markSpec", payload: spec, priority: Default }],
  )

export const NodeAttr = <
  const Type extends string,
  const Attr extends string,
>(options: {
  readonly type: Type
  readonly attr: Attr
  readonly spec: AttributeSpec
}): Extension<{
  readonly nodeAttr: NodeAttrSpec<Type, Attr>
}> =>
  make(
    { nodeAttr: options },
    [{ type: "schema.nodeAttr", payload: options, priority: Default }],
  )

export const MarkAttr = <
  const Type extends string,
  const Attr extends string,
>(options: {
  readonly type: Type
  readonly attr: Attr
  readonly spec: AttributeSpec
}): Extension<{
  readonly markAttr: MarkAttrSpec<Type, Attr>
}> =>
  make(
    { markAttr: options },
    [{ type: "schema.markAttr", payload: options, priority: Default }],
  )

export const priority =
  (priority: Priority) =>
  <Spec>(extension: Extension<Spec>): Extension<Spec> =>
    make(
      extension.spec,
      extension.contributions.map((item) => ({ ...item, priority })),
    )
