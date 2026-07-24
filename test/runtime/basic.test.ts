// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import { createEditor } from "../../src/index.js"
import * as Basic from "../../src/extensions/basic.js"

describe("Basic", () => {
  it("creates a mountable document with a paragraph and supports text transactions", async () => {
    const element = document.body.appendChild(document.createElement("div"))
    const editor = createEditor({ extension: Basic.make(), element })

    expect(editor.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    })
    expect(editor.view.dom.querySelector("p")).not.toBeNull()

    expect(editor.transact(({ tr }) => tr.insertText("hello"))).toBe(true)
    expect(editor.state.doc.textContent).toBe("hello")
    expect(editor.view.state).toBe(editor.core.state)

    await editor.destroy()
  })
})
