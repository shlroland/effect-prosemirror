import {
  chainCommands,
  createParagraphNear,
  deleteSelection,
  joinBackward,
  joinForward,
  liftEmptyBlock,
  newlineInCode,
  selectNodeBackward,
  selectNodeForward,
  splitBlock,
} from "prosemirror-commands"

import * as Command from "../internal/Command.js"
import * as CommandInvocation from "../internal/CommandInvocation.js"
import * as Extension from "../internal/Extension.js"
import * as Key from "../internal/Key.js"
import * as KeyChord from "../internal/KeyChord.js"
import * as Keymap from "../internal/Keymap.js"
import * as BaseCommands from "./base-commands.js"

export class Enter extends Command.Tag("handleEnter")<Enter, []>() {}
export class Backspace extends Command.Tag("handleBackspace")<Backspace, []>() {}
export class DeleteForward extends Command.Tag("handleDeleteForward")<DeleteForward, []>() {}

const enter = Command.define(Enter, {
  run: () => chainCommands(newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock),
})

const backspace = Command.define(Backspace, {
  run: () => chainCommands(deleteSelection, joinBackward, selectNodeBackward),
})

const deleteForward = Command.define(DeleteForward, {
  run: () => chainCommands(deleteSelection, joinForward, selectNodeForward),
})

export const make = () =>
  Extension.union(
    Extension.Commands(enter, backspace, deleteForward),
    Extension.Keymap(
      Keymap.bind(KeyChord.make({ key: Key.Enter }), CommandInvocation.make(Enter)),
      Keymap.bind(KeyChord.make({ key: Key.Backspace }), CommandInvocation.make(Backspace)),
      Keymap.bind(
        KeyChord.make({ modifiers: [KeyChord.Modifier.Mod], key: Key.Backspace }),
        CommandInvocation.make(Backspace),
      ),
      Keymap.bind(KeyChord.make({ key: Key.Delete }), CommandInvocation.make(DeleteForward)),
      Keymap.bind(
        KeyChord.make({ modifiers: [KeyChord.Modifier.Mod], key: Key.Delete }),
        CommandInvocation.make(DeleteForward),
      ),
      Keymap.bind(
        KeyChord.make({ modifiers: [KeyChord.Modifier.Mod], key: Key.Character("a") }),
        CommandInvocation.make(BaseCommands.SelectAll),
      ),
    ),
  )
