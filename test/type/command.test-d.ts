import { expectTypeOf } from "expect-type"

import * as Command from "../../src/core/Command.js"
import * as Extension from "../../src/core/Extension.js"

const setHeading = Command.define({
  run: (level: number) => () => level >= 1 && level <= 6,
  isActive: (level: number) => () => level === 1,
})

expectTypeOf(setHeading.run).parameters.toEqualTypeOf<[level: number]>()
expectTypeOf<NonNullable<typeof setHeading.isActive>>().parameters.toEqualTypeOf<[level: number]>()

const commands = Extension.Commands({ setHeading })

expectTypeOf(commands.spec.commands.setHeading).toEqualTypeOf<typeof setHeading>()
expectTypeOf(commands.spec.commands.setHeading.run).parameters.toEqualTypeOf<[level: number]>()

Extension.Commands({
  // @ts-expect-error Commands must be created through Command.define.
  unbranded: {
    _tag: "CommandDefinition",
    run: () => "not a command",
  },
})

Command.define({
  run: (level: number) => () => level >= 1 && level <= 6,
  // @ts-expect-error isActive must accept the same user-facing arguments as run.
  isActive: (name: string) => () => name === "heading",
})

Command.define({
  run: (level: number, name: string) => () => level >= 1 && name.length > 0,
  // @ts-expect-error isActive cannot omit a user-facing argument accepted by run.
  isActive: (level: number) => () => level === 1,
})

Command.define({
  // @ts-expect-error run must return a synchronous ProseMirror command.
  run: () => "not a command",
})
