import { describe, expect, it } from "vitest"

import { Command } from "../../src/core.js"

class SetText extends Command.Tag("setText")<SetText, [text: string]>() {}

describe("Command", () => {
  it("creates a nominal command tag with a public name", () => {
    expect(SetText._tag).toBe("CommandTag")
    expect(SetText.commandName).toBe("setText")
  })

  it("associates synchronous run and isActive creators with a tag", () => {
    const run = (text: string) => () => text.length > 0
    const isActive = (text: string) => () => text === "active"

    const command = Command.define(SetText, { run, isActive })

    expect(command).toMatchObject({
      _tag: "CommandDefinition",
      tag: SetText,
      run,
      isActive,
    })
  })

  it("omits isActive when it is not defined", () => {
    const command = Command.define(SetText, {
      run: () => () => true,
    })

    expect(Object.hasOwn(command, "isActive")).toBe(false)
  })
})
