import { toggleMark } from "prosemirror-commands"

import * as Command from "../internal/Command.js"
import * as CommandInvocation from "../internal/CommandInvocation.js"
import * as Extension from "../internal/Extension.js"
import * as Key from "../internal/Key.js"
import * as KeyChord from "../internal/KeyChord.js"
import * as Keymap from "../internal/Keymap.js"
import * as MarkInputRule from "../internal/MarkInputRule.js"

export class Toggle extends Command.Tag("toggleStrong")<Toggle, []>() {}

const toggle = Command.define(Toggle, {
  run: () => (state, dispatch, view) => {
    const strong = state.schema.marks.strong
    return strong ? toggleMark(strong)(state, dispatch, view) : false
  },
})

const shortcut = Keymap.bind(
  KeyChord.make({ modifiers: [KeyChord.Modifier.Mod], key: Key.Character("b") }),
  CommandInvocation.make(Toggle),
)

export const make = () =>
  Extension.union(
    Extension.MarkSpec({
      name: "strong",
      parseDOM: [{ tag: "strong" }, { tag: "b" }],
      toDOM: () => ["strong", 0],
    }),
    Extension.Commands(toggle),
    Extension.Keymap(shortcut),
    Extension.InputRules(
      MarkInputRule.make({
        match: /(?:^|\s)\*\*([^\s*]|[^\s*][^*]*[^\s*])\*\*$/,
        mark: "strong",
      }),
    ),
  )
