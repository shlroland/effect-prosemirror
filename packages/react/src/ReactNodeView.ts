import type { Node as ProseMirrorNode } from "prosemirror-model"
import type { Decoration, DecorationSource } from "prosemirror-view"
import { createElement, type ComponentType } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"

import { NodeView } from "effect-prosemirror"

export type Props = NodeView.Context

const createAdapter = <Name extends string>(
  options: {
    readonly node: Name
    readonly component: ComponentType<Props>
  },
  spec: { readonly contentDOM: boolean },
): NodeView.Adapter<Name> => ({
  node: options.node,
  create: (context) => {
    const dom = document.createElement("div")
    const reactDOM = document.createElement("div")
    const contentDOM = spec.contentDOM ? document.createElement("div") : null
    dom.append(reactDOM)
    if (contentDOM) dom.append(contentDOM)
    const root = createRoot(reactDOM)

    const render = (next: NodeView.Context) => {
      flushSync(() => {
        root.render(createElement(options.component, next))
      })
    }

    render(context)

    return {
      dom,
      contentDOM,
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
      ignoreMutation: spec.contentDOM
        ? (mutation) => reactDOM.contains(mutation.target as Node | null)
        : () => true,
    }
  },
})

export const atom = <const Name extends string>(options: {
  readonly node: Name
  readonly component: ComponentType<Props>
}): NodeView.Adapter<Name> => createAdapter(options, { contentDOM: false })

export const content = <const Name extends string>(options: {
  readonly node: Name
  readonly component: ComponentType<Props>
}): NodeView.Adapter<Name> => createAdapter(options, { contentDOM: true })
