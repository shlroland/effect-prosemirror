import * as Extension from "../internal/Extension.js"
import * as BaseCommands from "./base-commands.js"
import * as Doc from "./doc.js"
import * as Paragraph from "./paragraph.js"
import * as Text from "./text.js"

export const make = () =>
  Extension.union(Doc.make(), Text.make(), Paragraph.make(), BaseCommands.make())
