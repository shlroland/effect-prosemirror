import { setBlockType } from "prosemirror-commands"

import * as Command from "../internal/Command.js"
import * as CommandInvocation from "../internal/CommandInvocation.js"
import * as Extension from "../internal/Extension.js"
import * as Key from "../internal/Key.js"
import * as KeyChord from "../internal/KeyChord.js"
import * as Keymap from "../internal/Keymap.js"
import * as NodeInputRule from "../internal/NodeInputRule.js"

export type Level = 1 | 2 | 3 | 4 | 5 | 6

export class SetLevel extends Command.Tag("setHeadingLevel")<SetLevel, [level: Level]>() {}

const setLevel = Command.define(SetLevel, {
  run: (level) => (state, dispatch) => {
    const heading = state.schema.nodes.heading
    return heading ? setBlockType(heading, { level })(state, dispatch) : false
  },
  isActive: (level) => (state) => {
    const heading = state.schema.nodes.heading
    return (
      state.selection.$from.parent.type === heading &&
      state.selection.$from.parent.attrs.level === level
    )
  },
})

export const make = () =>
  Extension.union(
    Extension.NodeSpec({
      name: "heading",
      attrs: { level: { default: 1 } },
      content: "inline*",
      group: "block",
      defining: true,
      parseDOM: [
        { tag: "h1", attrs: { level: 1 } },
        { tag: "h2", attrs: { level: 2 } },
        { tag: "h3", attrs: { level: 3 } },
        { tag: "h4", attrs: { level: 4 } },
        { tag: "h5", attrs: { level: 5 } },
        { tag: "h6", attrs: { level: 6 } },
      ],
      toDOM: (node) => [`h${node.attrs.level}`, 0] as const,
    }),
    Extension.Commands(setLevel),
    Extension.Keymap(
      Keymap.bind(
        KeyChord.make({
          modifiers: [KeyChord.Modifier.Mod, KeyChord.Modifier.Alt],
          key: Key.Digit(1),
        }),
        CommandInvocation.make(SetLevel, 1),
      ),
      Keymap.bind(
        KeyChord.make({
          modifiers: [KeyChord.Modifier.Mod, KeyChord.Modifier.Alt],
          key: Key.Digit(2),
        }),
        CommandInvocation.make(SetLevel, 2),
      ),
      Keymap.bind(
        KeyChord.make({
          modifiers: [KeyChord.Modifier.Mod, KeyChord.Modifier.Alt],
          key: Key.Digit(3),
        }),
        CommandInvocation.make(SetLevel, 3),
      ),
      Keymap.bind(
        KeyChord.make({
          modifiers: [KeyChord.Modifier.Mod, KeyChord.Modifier.Alt],
          key: Key.Digit(4),
        }),
        CommandInvocation.make(SetLevel, 4),
      ),
      Keymap.bind(
        KeyChord.make({
          modifiers: [KeyChord.Modifier.Mod, KeyChord.Modifier.Alt],
          key: Key.Digit(5),
        }),
        CommandInvocation.make(SetLevel, 5),
      ),
      Keymap.bind(
        KeyChord.make({
          modifiers: [KeyChord.Modifier.Mod, KeyChord.Modifier.Alt],
          key: Key.Digit(6),
        }),
        CommandInvocation.make(SetLevel, 6),
      ),
    ),
    Extension.InputRules(
      NodeInputRule.textblock({
        match: /^(#{1,6})\s$/,
        node: "heading",
        getAttrs: (match) => ({ level: match[1]?.length ?? 1 }),
      }),
    ),
  )
