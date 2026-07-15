import { describe, expect, it } from "vitest"

import * as Command from "../../src/core/Command.js"

describe("Command", () => {
  it("stores synchronous run and isActive creators", () => {
    const run = (text: string) => () => text.length > 0
    const isActive = (text: string) => () => text === "active"

    const command = Command.define({ run, isActive })

    expect(command).toMatchObject({
      _tag: "CommandDefinition",
      run,
      isActive,
    })
  })

  it("omits isActive when it is not defined", () => {
    const command = Command.define({
      run: () => () => true,
    })

    expect(Object.hasOwn(command, "isActive")).toBe(false)
  })
})
