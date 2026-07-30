import { expectTypeOf } from "expect-type"

import { createEditor } from "../../src/index.js"
import * as Basic from "../../src/extensions/basic.js"
import * as BaseCommands from "../../src/extensions/base-commands.js"
import * as Blockquote from "../../src/extensions/blockquote.js"
import * as CodeBlock from "../../src/extensions/code-block.js"
import * as Doc from "../../src/extensions/doc.js"
import * as EditingKeymap from "../../src/extensions/editing-keymap.js"
import * as Heading from "../../src/extensions/heading.js"
import * as Paragraph from "../../src/extensions/paragraph.js"
import * as Text from "../../src/extensions/text.js"

expectTypeOf(Doc.make().spec.nodeSpec.name).toEqualTypeOf<"doc">()
expectTypeOf(Paragraph.make().spec.nodeSpec.name).toEqualTypeOf<"paragraph">()
expectTypeOf(Text.make().spec.nodeSpec.name).toEqualTypeOf<"text">()

expectTypeOf(Basic.make().spec.extensions).toEqualTypeOf<
  readonly [
    ReturnType<typeof Doc.make>,
    ReturnType<typeof Text.make>,
    ReturnType<typeof Paragraph.make>,
    ReturnType<typeof BaseCommands.make>,
    ReturnType<typeof Heading.make>,
    ReturnType<typeof Blockquote.make>,
    ReturnType<typeof CodeBlock.make>,
    ReturnType<typeof EditingKeymap.make>,
  ]
>()

const editor = createEditor({
  extension: Basic.make(),
  element: document.createElement("div"),
})

editor.commands.run(Heading.SetLevel, 6)
editor.commands.run(Blockquote.Toggle)
editor.commands.run(CodeBlock.Set)

// @ts-expect-error Heading levels are limited to the schema's six HTML heading levels.
editor.commands.run(Heading.SetLevel, 7)
