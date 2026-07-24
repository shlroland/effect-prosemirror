import { expectTypeOf } from "expect-type"

import { Priority } from "../../src/core.js"

expectTypeOf(Priority.High).toMatchTypeOf<Priority.Priority>()
