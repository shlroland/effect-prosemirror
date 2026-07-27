import { expectTypeOf } from "expect-type"

import { EditingCore, Extension } from "../../src/core.js"
import * as Basic from "../../src/extensions/basic.js"
import * as History from "../../src/extensions/history.js"

const extension = Extension.union(Basic.make(), History.make())
const core = EditingCore.create({ extension })

expectTypeOf(History.make).parameters.toEqualTypeOf<[options?: History.Options]>()

core.commands.run(History.Undo)
core.commands.run(History.Redo)

// @ts-expect-error History commands do not accept arguments.
core.commands.run(History.Undo, "unexpected")
