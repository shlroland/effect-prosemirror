// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import { Extension, Key, KeyChord } from "../../src/core.js"
import * as Basic from "../../src/extensions/basic.js"
import * as Emphasis from "../../src/extensions/emphasis.js"
import { createTestCore } from "../support/TestCore.js"
import { createTestEditor } from "../support/TestEditor.js"

describe("Emphasis", () => {
  it("wraps the tagged selection in an emphasis mark", async () => {
    const test = createTestCore({
      extension: Extension.union(Basic.make(), Emphasis.make()),
    })
    test.set("hello <a>world<b>")

    expect(test.core.commands.canRun(Emphasis.Toggle)).toBe(true)
    expect(test.core.commands.run(Emphasis.Toggle)).toBe(true)
    expect(test.core.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "hello " },
            { type: "text", marks: [{ type: "em" }], text: "world" },
          ],
        },
      ],
    })

    await test.core.destroy()
  })

  it("contributes a Mod-I shortcut for its Toggle Command", async () => {
    const test = createTestCore({
      extension: Extension.union(Basic.make(), Emphasis.make()),
    })
    const chord = KeyChord.make({
      modifiers: [KeyChord.Modifier.Mod],
      key: Key.Character("i"),
    })

    expect(test.core.keymap.bindingsFor(chord).map(({ invocation }) => invocation.tag)).toEqual([
      Emphasis.Toggle,
    ])

    await test.core.destroy()
  })

  it("turns Markdown delimiters typed through the Editor View into an emphasis mark", async () => {
    const test = createTestEditor({
      extension: Extension.union(Basic.make(), Emphasis.make()),
    })
    test.set("<a>")

    test.inputText("*word*")

    expect(test.editor.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", marks: [{ type: "em" }], text: "word" }],
        },
      ],
    })

    await test.editor.destroy()
  })
})
