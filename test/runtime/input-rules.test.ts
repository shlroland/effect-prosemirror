// @vitest-environment jsdom

import { InputRule } from "prosemirror-inputrules"
import { describe, expect, it } from "vitest"

import { EditingCore, Extension, Priority } from "../../src/core.js"
import * as Basic from "../../src/extensions/basic.js"
import * as Emphasis from "../../src/extensions/emphasis.js"
import * as Strong from "../../src/extensions/strong.js"
import { createTestEditor } from "../support/TestEditor.js"

describe("Input Rules Contribution", () => {
  it("merges composed mark rules into one native Input Rules Plugin", async () => {
    const core = EditingCore.create({
      extension: Extension.union(Basic.make(), Strong.make(), Emphasis.make()),
    })

    expect(core.state.plugins.filter((plugin) => plugin.spec.isInputRules === true)).toHaveLength(1)

    await core.destroy()
  })

  it("runs higher-priority matching rules first", async () => {
    const low = Extension.InputRules(
      new InputRule(/x$/, (state, _, start, end) => state.tr.insertText("low", start, end)),
    ).pipe(Extension.priority(Priority.Low))
    const high = Extension.InputRules(
      new InputRule(/x$/, (state, _, start, end) => state.tr.insertText("high", start, end)),
    ).pipe(Extension.priority(Priority.High))
    const test = createTestEditor({ extension: Extension.union(Basic.make(), low, high) })
    test.set("<a>")

    test.inputText("x")

    expect(test.editor.state.doc.textContent).toBe("high")

    await test.editor.destroy()
  })
})
