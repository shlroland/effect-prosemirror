import { expectTypeOf } from "expect-type"

import { Command } from "../../src/core.js"
import { createEditor } from "../../src/index.js"
import * as BaseCommands from "../../src/extensions/base-commands.js"
import * as Basic from "../../src/extensions/basic.js"

const commands = BaseCommands.make()

expectTypeOf(commands.spec.commandDefinitions).toEqualTypeOf<
  readonly [
    Command.CommandDefinition<typeof BaseCommands.InsertText>,
    Command.CommandDefinition<typeof BaseCommands.DeleteSelection>,
    Command.CommandDefinition<typeof BaseCommands.SelectAll>,
    Command.CommandDefinition<typeof BaseCommands.SplitParagraph>,
  ]
>()

const editor = createEditor({
  extension: Basic.make(),
  element: document.createElement("div"),
})

editor.commands.run(BaseCommands.InsertText, "hello")
editor.commands.run(BaseCommands.DeleteSelection)
editor.commands.run(BaseCommands.SelectAll)
editor.commands.run(BaseCommands.SplitParagraph)

// @ts-expect-error Base commands without user-facing arguments do not accept arguments.
editor.commands.run(BaseCommands.DeleteSelection, "text")
