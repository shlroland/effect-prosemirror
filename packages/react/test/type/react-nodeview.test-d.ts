import { expectTypeOf } from "expect-type"

import { Basic, EditingCore, Extension, NodeView } from "effect-prosemirror"

import { ReactNodeView } from "../../src/index.js"

const adapter = ReactNodeView.atom({
  node: "paragraph",
  component: (_props: NodeView.Context) => null,
})
const content = ReactNodeView.content({
  node: "paragraph",
  component: (_props: NodeView.Context) => null,
})

expectTypeOf(adapter.node).toEqualTypeOf<"paragraph">()
expectTypeOf(adapter).toMatchTypeOf<NodeView.Adapter<"paragraph">>()
expectTypeOf(content.node).toEqualTypeOf<"paragraph">()
expectTypeOf(content).toMatchTypeOf<NodeView.Adapter<"paragraph">>()

EditingCore.create({
  extension: Extension.union(Basic.make(), Extension.NodeView(adapter)),
})

const missing = ReactNodeView.atom({
  node: "missing",
  component: () => null,
})
const invalid = Extension.union(Basic.make(), Extension.NodeView(missing))

// @ts-expect-error NodeViews must target a node contributed by the final Extension Union.
EditingCore.create({ extension: invalid })
