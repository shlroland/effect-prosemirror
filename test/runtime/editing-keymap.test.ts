// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import { Key, KeyChord } from "../../src/core.js"
import * as Basic from "../../src/extensions/basic.js"
import * as CodeBlock from "../../src/extensions/code-block.js"
import * as EditingKeymap from "../../src/extensions/editing-keymap.js"
import { createTestCore } from "../support/TestCore.js"
import { createTestEditor } from "../support/TestEditor.js"

describe("EditingKeymap", () => {
  it("splits the current text block through its Enter Command", async () => {
    const test = createTestCore({
      extension: Basic.make(),
    })
    test.set("one<a>two")

    expect(test.core.commands.run(EditingKeymap.Enter)).toBe(true)
    expect(test.core.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "one" }] },
        { type: "paragraph", content: [{ type: "text", text: "two" }] },
      ],
    })

    await test.core.destroy()
  })

  it("handles Enter through the mounted ProseMirror keymap plugin", async () => {
    const test = createTestEditor({ extension: Basic.make() })
    test.set("one<a>two")

    test.editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
    )

    expect(test.editor.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "one" }] },
        { type: "paragraph", content: [{ type: "text", text: "two" }] },
      ],
    })

    await test.editor.destroy()
  })

  it("contributes the base editing key bindings without list-specific behavior", async () => {
    const test = createTestCore({
      extension: Basic.make(),
    })

    expect(
      test.core.keymap
        .bindingsFor(KeyChord.make({ key: Key.Enter }))
        .map(({ invocation }) => invocation.tag),
    ).toEqual([EditingKeymap.Enter])
    expect(
      test.core.keymap
        .bindingsFor(KeyChord.make({ key: Key.Backspace }))
        .map(({ invocation }) => invocation.tag),
    ).toEqual([EditingKeymap.Backspace])
    expect(
      test.core.keymap
        .bindingsFor(KeyChord.make({ key: Key.Delete }))
        .map(({ invocation }) => invocation.tag),
    ).toEqual([EditingKeymap.DeleteForward])
    expect(
      test.core.keymap
        .bindingsFor(KeyChord.make({ modifiers: [KeyChord.Modifier.Mod], key: Key.Enter }))
        .map(({ invocation }) => invocation.tag),
    ).toEqual([CodeBlock.Exit])

    await test.core.destroy()
  })
})
