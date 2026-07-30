// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import { Key, KeyChord } from "../../src/core.js"
import * as Basic from "../../src/extensions/basic.js"
import * as Heading from "../../src/extensions/heading.js"
import { createTestCore } from "../support/TestCore.js"
import { createTestEditor } from "../support/TestEditor.js"

describe("Heading", () => {
  it("changes the current paragraph to the requested heading level", async () => {
    const test = createTestCore({
      extension: Basic.make(),
    })
    test.set("<a>Title")

    expect(test.core.commands.canRun(Heading.SetLevel, 2)).toBe(true)
    expect(test.core.commands.run(Heading.SetLevel, 2)).toBe(true)
    expect(test.core.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Title" }],
        },
      ],
    })

    await test.core.destroy()
  })

  it("contributes a Mod-Alt digit shortcut and Markdown input rule", async () => {
    const test = createTestEditor({
      extension: Basic.make(),
    })
    test.set("<a>")

    expect(
      test.core.keymap
        .bindingsFor(
          KeyChord.make({
            modifiers: [KeyChord.Modifier.Mod, KeyChord.Modifier.Alt],
            key: Key.Digit(1),
          }),
        )
        .map(({ invocation }) => invocation.tag),
    ).toEqual([Heading.SetLevel])

    test.inputText("# ")

    expect(test.editor.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [{ type: "heading", attrs: { level: 1 } }],
    })

    await test.editor.destroy()
  })
})
