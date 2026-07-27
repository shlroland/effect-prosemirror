import * as EffectSchema from "effect/Schema"
import { expectTypeOf } from "expect-type"
import { Plugin } from "prosemirror-state"

import { Extension, Priority } from "../../src/core.js"

const first = Extension.contribution("test.first", { value: 1 })
const second = Extension.contribution("test.second", { value: 2 })

const combined = Extension.union(first, second)

expectTypeOf(combined.spec.extensions).toEqualTypeOf<readonly [typeof first, typeof second]>()

const third = Extension.contribution("test.third", { value: 3 })
const piped = first.pipe(Extension.union(second, third))
const expectedPiped: Extension.Extension<
  Extension.UnionSpec<readonly [typeof first, typeof second, typeof third]>
> = piped

expectTypeOf(expectedPiped.spec.extensions).toEqualTypeOf<
  readonly [typeof first, typeof second, typeof third]
>()

const highPriority = combined.pipe(Extension.priority(Priority.High))

expectTypeOf(highPriority.spec).toEqualTypeOf<typeof combined.spec>()

const paragraph = Extension.NodeSpec({
  name: "paragraph",
  content: "inline*",
})

expectTypeOf(paragraph.spec.nodeSpec.name).toEqualTypeOf<"paragraph">()

const bold = Extension.MarkSpec({
  name: "bold",
  parseDOM: [{ tag: "strong" }],
})

expectTypeOf(bold.spec.markSpec.name).toEqualTypeOf<"bold">()

const textAlign = Extension.NodeAttr({
  type: "paragraph",
  attr: "textAlign",
  spec: { default: null },
})

expectTypeOf(textAlign.spec.nodeAttr.type).toEqualTypeOf<"paragraph">()
expectTypeOf(textAlign.spec.nodeAttr.attr).toEqualTypeOf<"textAlign">()

const href = Extension.MarkAttr({
  type: "link",
  attr: "href",
  spec: { default: null },
})

expectTypeOf(href.spec.markAttr.type).toEqualTypeOf<"link">()
expectTypeOf(href.spec.markAttr.attr).toEqualTypeOf<"href">()

const checkedTextAlign = Extension.NodeAttr({
  type: "paragraph",
  attr: "textAlign",
  default: "left",
  schema: EffectSchema.Literal("left", "center", "right"),
})

expectTypeOf(checkedTextAlign.spec.nodeAttr.type).toEqualTypeOf<"paragraph">()

const statePlugin = new Plugin<number>({
  state: {
    init: () => 0,
    apply: (_, value) => value,
  },
})
const pluginExtension = Extension.Plugin(statePlugin)

expectTypeOf(pluginExtension.spec.statePlugin).toEqualTypeOf<typeof statePlugin>()
expectTypeOf(checkedTextAlign.spec.nodeAttr.attr).toEqualTypeOf<"textAlign">()
