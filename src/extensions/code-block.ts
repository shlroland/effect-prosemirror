import { exitCode, setBlockType } from "prosemirror-commands"

import * as Command from "../internal/Command.js"
import * as CommandInvocation from "../internal/CommandInvocation.js"
import * as Extension from "../internal/Extension.js"
import * as Key from "../internal/Key.js"
import * as KeyChord from "../internal/KeyChord.js"
import * as Keymap from "../internal/Keymap.js"
import * as NodeInputRule from "../internal/NodeInputRule.js"

export class Set extends Command.Tag("setCodeBlock")<Set, []>() {}
export class Exit extends Command.Tag("exitCodeBlock")<Exit, []>() {}

const set = Command.define(Set, {
  run: () => (state, dispatch) => {
    const codeBlock = state.schema.nodes.code_block
    return codeBlock ? setBlockType(codeBlock)(state, dispatch) : false
  },
  isActive: () => (state) => state.selection.$from.parent.type === state.schema.nodes.code_block,
})

const exit = Command.define(Exit, {
  run: () => exitCode,
})

export const make = () =>
  Extension.union(
    Extension.NodeSpec({
      name: "code_block",
      content: "text*",
      group: "block",
      code: true,
      defining: true,
      marks: "",
      parseDOM: [{ tag: "pre", preserveWhitespace: "full" }],
      toDOM: () => ["pre", ["code", 0]] as const,
    }),
    Extension.Commands(set, exit),
    Extension.Keymap(
      Keymap.bind(
        KeyChord.make({ modifiers: [KeyChord.Modifier.Mod], key: Key.Enter }),
        CommandInvocation.make(Exit),
      ),
    ),
    Extension.InputRules(
      NodeInputRule.textblock({ match: /^```(?:[^`]*)?\s$/, node: "code_block" }),
    ),
  )
