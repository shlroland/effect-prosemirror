import { expectTypeOf } from "expect-type"

import * as Basic from "../../src/extensions/basic.js"
import * as BaseCommands from "../../src/extensions/base-commands.js"
import * as Doc from "../../src/extensions/doc.js"
import * as Paragraph from "../../src/extensions/paragraph.js"
import * as Text from "../../src/extensions/text.js"

expectTypeOf(Doc.make().spec.nodeSpec.name).toEqualTypeOf<"doc">()
expectTypeOf(Paragraph.make().spec.nodeSpec.name).toEqualTypeOf<"paragraph">()
expectTypeOf(Text.make().spec.nodeSpec.name).toEqualTypeOf<"text">()

expectTypeOf(Basic.make().spec.extensions).toEqualTypeOf<
  readonly [
    ReturnType<typeof Doc.make>,
    ReturnType<typeof Text.make>,
    ReturnType<typeof Paragraph.make>,
    ReturnType<typeof BaseCommands.make>,
  ]
>()
