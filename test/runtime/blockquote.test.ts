// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import * as Basic from "../../src/extensions/basic.js"
import * as Blockquote from "../../src/extensions/blockquote.js"
import { createTestCore } from "../support/TestCore.js"
import { createTestEditor } from "../support/TestEditor.js"

describe("Blockquote", () => {
  it("wraps the current block and lifts it back out when toggled again", async () => {
    const test = createTestCore({
      extension: Basic.make(),
    })
    test.set("<a>Quoted")

    expect(test.core.commands.run(Blockquote.Toggle)).toBe(true)
    expect(test.core.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Quoted" }] }],
        },
      ],
    })

    expect(test.core.commands.run(Blockquote.Toggle)).toBe(true)
    expect(test.core.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Quoted" }] }],
    })

    await test.core.destroy()
  })

  it("wraps a paragraph when its Markdown input syntax is typed", async () => {
    const test = createTestEditor({
      extension: Basic.make(),
    })
    test.set("<a>")

    test.inputText("> ")

    expect(test.editor.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [{ type: "blockquote", content: [{ type: "paragraph" }] }],
    })

    await test.editor.destroy()
  })
})
