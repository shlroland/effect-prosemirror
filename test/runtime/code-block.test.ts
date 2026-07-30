// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import * as Basic from "../../src/extensions/basic.js"
import * as CodeBlock from "../../src/extensions/code-block.js"
import { createTestCore } from "../support/TestCore.js"
import { createTestEditor } from "../support/TestEditor.js"

describe("CodeBlock", () => {
  it("changes the current block to code and exits it into a paragraph", async () => {
    const test = createTestCore({
      extension: Basic.make(),
    })
    test.set("console.log()<a>")

    expect(test.core.commands.run(CodeBlock.Set)).toBe(true)
    expect(test.core.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [{ type: "code_block", content: [{ type: "text", text: "console.log()" }] }],
    })

    expect(test.core.commands.run(CodeBlock.Exit)).toBe(true)
    expect(test.core.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [
        { type: "code_block", content: [{ type: "text", text: "console.log()" }] },
        { type: "paragraph" },
      ],
    })

    await test.core.destroy()
  })

  it("changes a paragraph to a code block from its Markdown input syntax", async () => {
    const test = createTestEditor({
      extension: Basic.make(),
    })
    test.set("<a>")

    test.inputText("``` ")

    expect(test.editor.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [{ type: "code_block" }],
    })

    await test.editor.destroy()
  })
})
