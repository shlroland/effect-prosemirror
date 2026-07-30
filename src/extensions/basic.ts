import * as Extension from "../internal/Extension.js"
import * as BaseCommands from "./base-commands.js"
import * as Blockquote from "./blockquote.js"
import * as CodeBlock from "./code-block.js"
import * as Doc from "./doc.js"
import * as EditingKeymap from "./editing-keymap.js"
import * as Heading from "./heading.js"
import * as Paragraph from "./paragraph.js"
import * as Text from "./text.js"

export const make = () =>
  Extension.union(
    Doc.make(),
    Text.make(),
    Paragraph.make(),
    BaseCommands.make(),
    Heading.make(),
    Blockquote.make(),
    CodeBlock.make(),
    EditingKeymap.make(),
  )
