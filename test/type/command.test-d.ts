import { expectTypeOf } from "expect-type"

import { Command, Extension } from "../../src/core.js"

class SetHeading extends Command.Tag("setHeading")<SetHeading, [level: number]>() {}

const setHeading = Command.define(SetHeading, {
  run: (level) => () => level >= 1 && level <= 6,
  isActive: (level) => () => level === 1,
})

expectTypeOf(setHeading.tag).toEqualTypeOf<typeof SetHeading>()
expectTypeOf(setHeading.run).parameters.toEqualTypeOf<[level: number]>()
expectTypeOf<NonNullable<typeof setHeading.isActive>>().parameters.toEqualTypeOf<[level: number]>()

const commands = Extension.Commands(setHeading)

expectTypeOf(commands.spec.commandDefinitions).toEqualTypeOf<readonly [typeof setHeading]>()
expectTypeOf(commands.spec.commandDefinitions[0].run).parameters.toEqualTypeOf<[level: number]>()

Command.define(SetHeading, {
  // @ts-expect-error run must accept the Command Tag's argument tuple.
  run: (name: string) => () => name === "heading",
})

Command.define(SetHeading, {
  run: (level) => () => level >= 1 && level <= 6,
  // @ts-expect-error isActive must accept the Command Tag's argument tuple.
  isActive: (name: string) => () => name === "heading",
})

Command.define(SetHeading, {
  // @ts-expect-error run must return a synchronous ProseMirror command.
  run: () => "not a command",
})
