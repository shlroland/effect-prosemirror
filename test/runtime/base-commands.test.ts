// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import { TextSelection } from "prosemirror-state"

import { createEditor } from "../../src/index.js"
import * as BaseCommands from "../../src/extensions/base-commands.js"
import * as Basic from "../../src/extensions/basic.js"

describe("BaseCommands", () => {
  it("inserts non-empty text through the Basic command surface", async () => {
    const element = document.body.appendChild(document.createElement("div"))
    const editor = createEditor({ extension: Basic.make(), element })

    expect(editor.commands.canRun(BaseCommands.InsertText, "hello")).toBe(true)
    expect(editor.commands.run(BaseCommands.InsertText, "hello")).toBe(true)
    expect(editor.state.doc.textContent).toBe("hello")
    expect(editor.commands.canRun(BaseCommands.InsertText, "")).toBe(false)

    await editor.destroy()
  })

  it("deletes a non-empty selection and declines an empty selection", async () => {
    const element = document.body.appendChild(document.createElement("div"))
    const editor = createEditor({ extension: Basic.make(), element })

    editor.commands.run(BaseCommands.InsertText, "hello")
    editor.transact(({ state, tr }) => tr.setSelection(TextSelection.create(state.doc, 1, 6)))

    expect(editor.commands.canRun(BaseCommands.DeleteSelection)).toBe(true)
    expect(editor.commands.run(BaseCommands.DeleteSelection)).toBe(true)
    expect(editor.state.doc.textContent).toBe("")
    expect(editor.commands.canRun(BaseCommands.DeleteSelection)).toBe(false)

    await editor.destroy()
  })

  it("selects the complete document once", async () => {
    const element = document.body.appendChild(document.createElement("div"))
    const editor = createEditor({ extension: Basic.make(), element })

    editor.commands.run(BaseCommands.InsertText, "hello")

    expect(editor.commands.canRun(BaseCommands.SelectAll)).toBe(true)
    expect(editor.commands.run(BaseCommands.SelectAll)).toBe(true)
    expect(editor.state.selection.from).toBe(0)
    expect(editor.state.selection.to).toBe(editor.state.doc.content.size)
    expect(editor.commands.canRun(BaseCommands.SelectAll)).toBe(false)

    await editor.destroy()
  })

  it("splits the current paragraph at an empty text selection", async () => {
    const element = document.body.appendChild(document.createElement("div"))
    const editor = createEditor({ extension: Basic.make(), element })

    editor.commands.run(BaseCommands.InsertText, "hello")

    expect(editor.commands.canRun(BaseCommands.SplitParagraph)).toBe(true)
    expect(editor.commands.run(BaseCommands.SplitParagraph)).toBe(true)
    expect(editor.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hello" }] },
        { type: "paragraph" },
      ],
    })

    await editor.destroy()
  })

  it("does not split a non-empty text selection", async () => {
    const element = document.body.appendChild(document.createElement("div"))
    const editor = createEditor({ extension: Basic.make(), element })

    editor.commands.run(BaseCommands.InsertText, "hello")
    editor.transact(({ state, tr }) => tr.setSelection(TextSelection.create(state.doc, 1, 6)))

    expect(editor.commands.canRun(BaseCommands.SplitParagraph)).toBe(false)
    expect(editor.commands.run(BaseCommands.SplitParagraph)).toBe(false)
    expect(editor.state.doc.textContent).toBe("hello")

    await editor.destroy()
  })
})
