import type { Attrs, Node } from "prosemirror-model"
import { InputRule } from "prosemirror-inputrules"
import { canJoin, findWrapping } from "prosemirror-transform"

type GetAttrs = Attrs | null | ((match: RegExpMatchArray) => Attrs | null)

const attrsFor = (getAttrs: GetAttrs, match: RegExpMatchArray): Attrs | null =>
  getAttrs instanceof Function ? getAttrs(match) : getAttrs

export const textblock = (options: {
  readonly match: RegExp
  readonly node: string
  readonly getAttrs?: GetAttrs
}): InputRule =>
  new InputRule(options.match, (state, match, start, end) => {
    const nodeType = state.schema.nodes[options.node]
    if (!nodeType) return null

    const $start = state.doc.resolve(start)
    if (!$start.node(-1).canReplaceWith($start.index(-1), $start.indexAfter(-1), nodeType)) {
      return null
    }

    return state.tr
      .delete(start, end)
      .setBlockType(start, start, nodeType, attrsFor(options.getAttrs ?? null, match))
  })

export const wrapping = (options: {
  readonly match: RegExp
  readonly node: string
  readonly getAttrs?: GetAttrs
  readonly joinPredicate?: (match: RegExpMatchArray, node: Node) => boolean
}): InputRule =>
  new InputRule(options.match, (state, match, start, end) => {
    const nodeType = state.schema.nodes[options.node]
    if (!nodeType) return null

    const attributes = attrsFor(options.getAttrs ?? null, match)
    const transaction = state.tr.delete(start, end)
    const range = transaction.doc.resolve(start).blockRange()
    const wrapping = range && findWrapping(range, nodeType, attributes)
    if (!wrapping) return null

    transaction.wrap(range, wrapping)
    const before = transaction.doc.resolve(start - 1).nodeBefore
    if (
      before?.type === nodeType &&
      canJoin(transaction.doc, start - 1) &&
      (!options.joinPredicate || options.joinPredicate(match, before))
    ) {
      transaction.join(start - 1)
    }

    return transaction
  })
