import { expectTypeOf } from "expect-type"

import { Command, Extension } from "../../src/core.js"
import { createEditor, type CreatedEditor } from "../../src/index.js"

const schema = Extension.union(
  Extension.NodeSpec({ name: "doc", content: "paragraph+" }),
  Extension.NodeSpec({ name: "paragraph", content: "text*" }),
  Extension.NodeSpec({ name: "text" }),
)

class InsertText extends Command.Tag("insertText")<InsertText, [text: string]>() {}
class Missing extends Command.Tag("missing")<Missing, []>() {}

const extension = Extension.union(
  schema,
  Extension.Commands(
    Command.define(InsertText, {
      run: (text) => () => text.length > 0,
    }),
  ),
)

const editor = createEditor({
  extension,
  element: document.createElement("div"),
})

expectTypeOf(editor).toMatchTypeOf<CreatedEditor<typeof InsertText>>()
editor.commands.run(InsertText, "text")

// @ts-expect-error The mounted convenience constructor retains command availability checks.
editor.commands.run(Missing)

// @ts-expect-error Command arguments are inferred from the selected Tag.
editor.commands.run(InsertText, 1)

const missingTarget = Extension.NodeAttr({
  type: "missing",
  attr: "value",
  default: null,
})

// @ts-expect-error createEditor inherits complete-core Final Validation.
createEditor({ extension: missingTarget, element: document.createElement("div") })
