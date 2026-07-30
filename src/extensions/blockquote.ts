import { lift, wrapIn } from "prosemirror-commands"
import type { EditorState } from "prosemirror-state"

import * as Command from "../internal/Command.js"
import * as Extension from "../internal/Extension.js"
import * as NodeInputRule from "../internal/NodeInputRule.js"

export class Toggle extends Command.Tag("toggleBlockquote")<Toggle, []>() {}

const isInBlockquote = (state: EditorState) => {
  const blockquote = state.schema.nodes.blockquote
  if (!blockquote) return false

  for (let depth = state.selection.$from.depth; depth > 0; depth -= 1) {
    if (state.selection.$from.node(depth).type === blockquote) return true
  }

  return false
}

const toggle = Command.define(Toggle, {
  run: () => (state, dispatch) => {
    const blockquote = state.schema.nodes.blockquote
    if (!blockquote) return false
    return isInBlockquote(state) ? lift(state, dispatch) : wrapIn(blockquote)(state, dispatch)
  },
  isActive: () => isInBlockquote,
})

export const make = () =>
  Extension.union(
    Extension.NodeSpec({
      name: "blockquote",
      content: "block+",
      group: "block",
      defining: true,
      parseDOM: [{ tag: "blockquote" }],
      toDOM: () => ["blockquote", 0] as const,
    }),
    Extension.Commands(toggle),
    Extension.InputRules(NodeInputRule.wrapping({ match: /^\s*>\s$/, node: "blockquote" })),
  )
