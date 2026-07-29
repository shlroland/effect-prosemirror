import { describe, expect, it } from "vitest"

import { Extension, Key, KeyChord } from "../../src/core.js"
import * as Basic from "../../src/extensions/basic.js"
import * as Strong from "../../src/extensions/strong.js"
import { createTestCore } from "../support/TestCore.js"

describe("Strong", () => {
  it("wraps the tagged selection in a strong mark", async () => {
    const test = createTestCore({
      extension: Extension.union(Basic.make(), Strong.make()),
    })
    test.set("hello <a>world<b>")

    expect(test.core.commands.canRun(Strong.Toggle)).toBe(true)
    expect(test.core.commands.run(Strong.Toggle)).toBe(true)
    expect(test.core.state.doc.toJSON()).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "hello " },
            { type: "text", marks: [{ type: "strong" }], text: "world" },
          ],
        },
      ],
    })

    await test.core.destroy()
  })

  it("contributes a Mod-B shortcut for its Toggle Command", async () => {
    const test = createTestCore({
      extension: Extension.union(Basic.make(), Strong.make()),
    })
    const chord = KeyChord.make({
      modifiers: [KeyChord.Modifier.Mod],
      key: Key.Character("b"),
    })

    expect(test.core.keymap.bindingsFor(chord).map(({ invocation }) => invocation.tag)).toEqual([
      Strong.Toggle,
    ])

    await test.core.destroy()
  })
})
