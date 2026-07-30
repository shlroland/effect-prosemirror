import type { Node as ProseMirrorNode } from "prosemirror-model"
import type {
  Decoration,
  DecorationSource,
  EditorView,
  NodeView as ProseMirrorNodeView,
  NodeViewConstructor,
} from "prosemirror-view"

import type { Contribution, Extension } from "./Extension.js"
import { Priority, type Priority as PriorityValue } from "./Priority.js"

export interface Context {
  readonly node: ProseMirrorNode
  readonly view: EditorView
  readonly getPos: () => number | undefined
  readonly decorations: readonly Decoration[]
  readonly innerDecorations: DecorationSource
}

export interface Adapter<Name extends string = string> {
  readonly node: Name
  readonly create: (context: Context) => ProseMirrorNodeView
}

export interface Registry {
  readonly adapters: ReadonlyMap<string, Adapter>
}

interface IndexedAdapter {
  readonly adapter: Adapter
  readonly priority: PriorityValue
  readonly index: number
}

const priorityRank: Record<PriorityValue, number> = {
  [Priority.Lowest]: 0,
  [Priority.Low]: 1,
  [Priority.Default]: 2,
  [Priority.High]: 3,
  [Priority.Highest]: 4,
}

const isNodeViewContribution = (
  contribution: Contribution,
): contribution is Contribution<"view.nodeView", Adapter> => contribution.type === "view.nodeView"

export const collect = (extension: Extension.Any): Registry => {
  const indexed: IndexedAdapter[] = []
  let index = 0

  for (const contribution of extension.contributions) {
    if (!isNodeViewContribution(contribution)) continue
    indexed.push({ adapter: contribution.payload, priority: contribution.priority, index })
    index += 1
  }

  indexed.sort((left, right) => {
    const priorityDifference = priorityRank[left.priority] - priorityRank[right.priority]
    return priorityDifference === 0 ? left.index - right.index : priorityDifference
  })

  return Object.freeze({
    adapters: new Map(indexed.map(({ adapter }) => [adapter.node, adapter])),
  })
}

export const constructors = (registry: Registry): Record<string, NodeViewConstructor> => {
  const result: Record<string, NodeViewConstructor> = {}

  for (const [name, adapter] of registry.adapters) {
    result[name] = (node, view, getPos, decorations, innerDecorations) =>
      adapter.create({ node, view, getPos, decorations, innerDecorations })
  }

  return result
}
