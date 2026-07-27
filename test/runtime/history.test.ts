import { describe, expect, it } from "vitest"

import { EditingCore, Extension } from "../../src/core.js"
import * as Basic from "../../src/extensions/basic.js"
import * as History from "../../src/extensions/history.js"

describe("History", () => {
  it("undoes and redoes Core transactions", async () => {
    const core = EditingCore.create({
      extension: Extension.union(Basic.make(), History.make()),
    })

    expect(core.commands.canRun(History.Undo)).toBe(false)
    expect(core.transact(({ tr }) => tr.insertText("hello"))).toBe(true)
    expect(core.commands.canRun(History.Undo)).toBe(true)

    expect(core.commands.run(History.Undo)).toBe(true)
    expect(core.state.doc.textContent).toBe("")
    expect(core.commands.canRun(History.Redo)).toBe(true)

    expect(core.commands.run(History.Redo)).toBe(true)
    expect(core.state.doc.textContent).toBe("hello")

    await core.destroy()
  })
})
