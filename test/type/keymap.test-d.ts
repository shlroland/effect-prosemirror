import { expectTypeOf } from "expect-type"

import {
  Command,
  CommandInvocation,
  EditingCore,
  Extension,
  Key,
  KeyChord,
  Keymap,
} from "../../src/core.js"

class SetHeading extends Command.Tag("setHeading")<SetHeading, [level: number]>() {}

const chord = KeyChord.make({
  modifiers: [KeyChord.Modifier.Mod, KeyChord.Modifier.Alt],
  key: Key.Digit(1),
})

const invocation = CommandInvocation.make(SetHeading, 1)
const binding = Keymap.bind(chord, invocation)
const keymap = Extension.Keymap(binding)

expectTypeOf(invocation.tag).toEqualTypeOf<typeof SetHeading>()
expectTypeOf(invocation.args).toEqualTypeOf<readonly [level: number]>()
expectTypeOf(keymap.spec.keyBindings).toEqualTypeOf<readonly [typeof binding]>()

// @ts-expect-error Command Invocation arguments come from the Command Tag.
CommandInvocation.make(SetHeading, "one")

const schema = Extension.union(
  Extension.NodeSpec({ name: "doc", content: "paragraph+" }),
  Extension.NodeSpec({ name: "paragraph", content: "text*" }),
  Extension.NodeSpec({ name: "text" }),
)

const missing = Extension.union(schema, keymap)

expectTypeOf<EditingCore.FinalValidation<typeof missing>>().toEqualTypeOf<{
  readonly extension: EditingCore.Diagnostic<
    "MissingCommandImplementation",
    { readonly command: "setHeading" }
  >
}>()

// @ts-expect-error Keymap Command Tags must be implemented at Editing Core Final Validation.
EditingCore.create({ extension: missing })

const complete = Extension.union(
  schema,
  keymap,
  Extension.Commands(Command.define(SetHeading, { run: () => () => true })),
)

EditingCore.create({ extension: complete })

// @ts-expect-error Digit keys are restricted to 0 through 9.
Key.Digit(10)

// @ts-expect-error Function keys are restricted to F1 through F24.
Key.Function(25)
