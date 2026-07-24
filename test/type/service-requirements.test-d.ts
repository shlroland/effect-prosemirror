import { Context, Effect, Layer } from "effect"
import { expectTypeOf } from "expect-type"

import * as EditingCore from "../../src/core/EditingCore.js"
import * as Extension from "../../src/core/Extension.js"
import { createEditor } from "../../src/index.js"

const schema = Extension.union(
  Extension.NodeSpec({ name: "doc", content: "paragraph+" }),
  Extension.NodeSpec({ name: "paragraph", content: "text*" }),
  Extension.NodeSpec({ name: "text" }),
)

class AuditService extends Context.Tag("test/AuditService")<
  AuditService,
  { readonly name: string }
>() {}

const required = Extension.union(schema, Extension.Require(AuditService))
const auditServiceLive = Layer.succeed(AuditService, { name: "audit" })

expectTypeOf<EditingCore.Requirements<typeof required>>().toEqualTypeOf<AuditService>()

const effect = Effect.scoped(EditingCore.make({ extension: required }))

// @ts-expect-error Effect-native construction requires the declared service.
Effect.runPromise(effect)

Effect.runPromise(effect.pipe(Effect.provide(auditServiceLive)))

// @ts-expect-error Synchronous creation must receive a Layer for declared services.
EditingCore.create({ extension: required })

EditingCore.create({ extension: required, layer: auditServiceLive })

// @ts-expect-error createEditor inherits synchronous service requirements.
createEditor({ extension: required, element: document.createElement("div") })

createEditor({
  extension: required,
  layer: auditServiceLive,
  element: document.createElement("div"),
})
