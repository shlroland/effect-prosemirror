import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import * as Command from "../../src/core/Command.js"
import * as CommandInvocation from "../../src/core/CommandInvocation.js"
import * as EditingCore from "../../src/core/EditingCore.js"
import { FinalValidationError, InvalidKeyError } from "../../src/core/Error.js"
import * as Extension from "../../src/core/Extension.js"
import * as Key from "../../src/core/Key.js"
import * as KeyChord from "../../src/core/KeyChord.js"
import * as Keymap from "../../src/core/Keymap.js"
import { Priority } from "../../src/core/Priority.js"

class SetHeading extends Command.Tag("setHeading")<SetHeading, [level: number]>() {}

const setHeading = Command.define(SetHeading, {
  run: () => () => true,
})

const schemaExtension = Extension.union(
  Extension.NodeSpec({ name: "doc", content: "paragraph+" }),
  Extension.NodeSpec({ name: "paragraph", content: "text*" }),
  Extension.NodeSpec({ name: "text" }),
)

const headingChord = KeyChord.make({
  modifiers: [KeyChord.Modifier.Mod, KeyChord.Modifier.Alt],
  key: Key.Digit(1),
})

describe("Static Keymap", () => {
  it("validates dynamic character keys through sync and Effect APIs", () => {
    expect(Key.Character("b")).toEqual({ _tag: "Character", value: "b" })
    expect(() => Key.Character("ab")).toThrow(InvalidKeyError)

    const exit = Effect.runSyncExit(Key.decodeCharacter(" "))
    expect(exit._tag).toBe("Failure")
  })

  it("normalizes modifiers as an unordered set", () => {
    const left = KeyChord.make({
      modifiers: [KeyChord.Modifier.Alt, KeyChord.Modifier.Mod, KeyChord.Modifier.Alt],
      key: Key.Digit(1),
    })
    const right = KeyChord.make({
      modifiers: [KeyChord.Modifier.Mod, KeyChord.Modifier.Alt],
      key: Key.Digit(1),
    })

    expect(left.modifiers).toEqual([KeyChord.Modifier.Mod, KeyChord.Modifier.Alt])
    expect(KeyChord.identity(left)).toBe(KeyChord.identity(right))
    expect(KeyChord.name(left)).toBe("Mod-Alt-1")
  })

  it("merges same-chord bindings by priority then declaration order", () => {
    const low = Keymap.bind(headingChord, CommandInvocation.make(SetHeading, 1))
    const high = Keymap.bind(headingChord, CommandInvocation.make(SetHeading, 2))

    const extension = Extension.union(
      Extension.Keymap(low).pipe(Extension.priority(Priority.Low)),
      Extension.Keymap(high).pipe(Extension.priority(Priority.High)),
    )
    const keymap = Keymap.collect(extension)

    expect(keymap.bindingsFor(headingChord).map(({ invocation }) => invocation.args)).toEqual([
      [2],
      [1],
    ])
  })

  it("keeps keymap command references forward-compatible until Final Validation", async () => {
    const binding = Keymap.bind(headingChord, CommandInvocation.make(SetHeading, 1))
    const keymapExtension = Extension.Keymap(binding)
    const extension = Extension.union(
      schemaExtension,
      keymapExtension,
      Extension.Commands(setHeading),
    )
    const core = EditingCore.create({ extension })

    expect(core.keymap.bindingsFor(headingChord)).toEqual([binding])
    await core.destroy()
  })

  it("reports a missing command implementation at Final Validation", () => {
    const binding = Keymap.bind(headingChord, CommandInvocation.make(SetHeading, 1))
    const invalid = Extension.union(schemaExtension, Extension.Keymap(binding))
    const createUnsafe = EditingCore.create as (options: EditingCore.Options) => EditingCore.Any

    try {
      createUnsafe({ extension: invalid })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(FinalValidationError)
      expect((error as FinalValidationError).diagnostics).toContainEqual({
        _tag: "MissingCommandImplementation",
        command: "setHeading",
      })
    }
  })
})
