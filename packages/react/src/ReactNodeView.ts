import type { Node as ProseMirrorNode } from "prosemirror-model"
import type { Decoration, DecorationSource } from "prosemirror-view"
import { createElement, type ComponentType } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"

import { NodeView } from "effect-prosemirror"

export type Props = NodeView.Context

export const atom = <const Name extends string>(options: {
  readonly node: Name
  readonly component: ComponentType<Props>
}): NodeView.Adapter<Name> => ({
  node: options.node,
  create: (context) => {
    const dom = document.createElement("div")
    const reactDOM = document.createElement("div")
    dom.append(reactDOM)
    const root = createRoot(reactDOM)

    const render = (next: NodeView.Context) => {
      flushSync(() => {
        root.render(createElement(options.component, next))
      })
    }

    render(context)

    return {
      dom,
      update: (
        node: ProseMirrorNode,
        decorations: readonly Decoration[],
        innerDecorations: DecorationSource,
      ) => {
        if (node.type.name !== options.node) return false
        render({
          node,
          view: context.view,
          getPos: context.getPos,
          decorations,
          innerDecorations,
        })
        return true
      },
      destroy: () => {
        root.unmount()
      },
      stopEvent: (event) => reactDOM.contains(event.target as Node | null),
      ignoreMutation: () => true,
    }
  },
})
