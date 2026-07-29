import { EditingCore, Extension } from "../../src/core.js"
import * as Basic from "../../src/extensions/basic.js"
import * as Emphasis from "../../src/extensions/emphasis.js"
import * as Strong from "../../src/extensions/strong.js"

const extension = Extension.union(Basic.make(), Strong.make(), Emphasis.make())
const core = EditingCore.create({ extension })

core.commands.run(Strong.Toggle)
core.commands.run(Emphasis.Toggle)

// @ts-expect-error Mark toggle Commands do not accept user-facing arguments.
core.commands.run(Strong.Toggle, "unexpected")

// @ts-expect-error Mark toggle Commands do not accept user-facing arguments.
core.commands.run(Emphasis.Toggle, "unexpected")
