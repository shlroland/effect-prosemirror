import { history, redo, undo } from "prosemirror-history"

import * as Command from "../internal/Command.js"
import * as Extension from "../internal/Extension.js"

export class Undo extends Command.Tag("undo")<Undo, []>() {}

export class Redo extends Command.Tag("redo")<Redo, []>() {}

export interface Options {
  readonly depth?: number
  readonly newGroupDelay?: number
}

export const make = (options?: Options) =>
  Extension.union(
    Extension.Plugin(history(options)),
    Extension.Commands(
      Command.define(Undo, { run: () => undo }),
      Command.define(Redo, { run: () => redo }),
    ),
  )
