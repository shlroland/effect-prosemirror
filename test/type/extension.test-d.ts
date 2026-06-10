import { expectTypeOf } from "expect-type"

import * as Extension from "../../src/core/Extension.js"
import { Priority } from "../../src/core/Priority.js"

const first = Extension.contribution("test.first", { value: 1 })
const second = Extension.contribution("test.second", { value: 2 })

const combined = Extension.union(first, second)

expectTypeOf(combined.spec.extensions).toEqualTypeOf<readonly [typeof first, typeof second]>()

const highPriority = combined.pipe(Extension.priority(Priority.High))

expectTypeOf(highPriority.spec).toEqualTypeOf<typeof combined.spec>()
