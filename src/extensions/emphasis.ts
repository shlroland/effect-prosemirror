import { toggleMark } from "prosemirror-commands"

import * as Command from "../internal/Command.js"
import * as CommandInvocation from "../internal/CommandInvocation.js"
import * as Extension from "../internal/Extension.js"
import * as Key from "../internal/Key.js"
import * as KeyChord from "../internal/KeyChord.js"
import * as Keymap from "../internal/Keymap.js"

export class Toggle extends Command.Tag("toggleEmphasis")<Toggle, []>() {}

const toggle = Command.define(Toggle, {
  run: () => (state, dispatch, view) => {
    const emphasis = state.schema.marks.em
    return emphasis ? toggleMark(emphasis)(state, dispatch, view) : false
  },
})

const shortcut = Keymap.bind(
  KeyChord.make({ modifiers: [KeyChord.Modifier.Mod], key: Key.Character("i") }),
  CommandInvocation.make(Toggle),
)

export const make = () =>
  Extension.union(
    Extension.MarkSpec({
      name: "em",
      parseDOM: [{ tag: "em" }, { tag: "i" }],
      toDOM: () => ["em", 0],
    }),
    Extension.Commands(toggle),
    Extension.Keymap(shortcut),
  )
