import { expectTypeOf } from "expect-type"

import type { Priority } from "../../src/core/Priority.js"
import { Priority as PriorityValues } from "../../src/core/Priority.js"

expectTypeOf(PriorityValues.High).toMatchTypeOf<Priority>()
