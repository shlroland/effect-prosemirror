import { expectTypeOf } from "expect-type"

import { Command, EditingCore, Extension } from "../../src/core.js"

const schema = Extension.union(
  Extension.NodeSpec({ name: "doc", content: "paragraph+" }),
  Extension.NodeSpec({ name: "paragraph", content: "text*" }),
  Extension.NodeSpec({ name: "text" }),
)

class SetHeading extends Command.Tag("setHeading")<SetHeading, [level: number]>() {}
class InsertTable extends Command.Tag("insertTable")<InsertTable, []>() {}

const extension = Extension.union(
  schema,
  Extension.Commands(
    Command.define(SetHeading, {
      run: (level) => () => level >= 1 && level <= 6,
    }),
  ),
)

const core = EditingCore.create({ extension })

expectTypeOf(core.commands.run).toBeFunction()
core.commands.run(SetHeading, 1)
core.commands.canRun(SetHeading, 2)
core.commands.isActive(SetHeading, 3)

// @ts-expect-error The current Editing Core does not implement this Tag.
core.commands.run(InsertTable)

// @ts-expect-error Command arguments are inferred from the selected Tag.
core.commands.run(SetHeading, "one")

const missingTarget = Extension.NodeAttr({
  type: "missing",
  attr: "value",
  default: null,
})

expectTypeOf<EditingCore.FinalValidation<typeof missingTarget>>().toEqualTypeOf<{
  readonly extension: EditingCore.Diagnostic<
    "MissingNodeTarget",
    { readonly type: "missing"; readonly attr: "value" }
  >
}>()

// @ts-expect-error Editing Core construction performs Final Validation.
EditingCore.create({ extension: missingTarget })
