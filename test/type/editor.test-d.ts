import { expectTypeOf } from "expect-type"

import * as Editor from "../../src/core/Editor.js"
import * as Extension from "../../src/core/Extension.js"

const missingNodeTarget = Extension.NodeAttr({
  type: "missingParagraph",
  attr: "textAlign",
  default: null,
})

expectTypeOf<Editor.FinalValidation<typeof missingNodeTarget>>().toEqualTypeOf<{
  readonly extension: Editor.Diagnostic<"MissingNodeTarget", {
    readonly type: "missingParagraph"
    readonly attr: "textAlign"
  }>
}>()

// @ts-expect-error Final Validation rejects node attrs without a target node spec.
Editor.layer({ extension: missingNodeTarget })

// @ts-expect-error Final Validation rejects node attrs without a target node spec.
Editor.make({ extension: missingNodeTarget })

// @ts-expect-error Final Validation rejects node attrs without a target node spec.
Editor.createEditor({ extension: missingNodeTarget })

const missingMarkTarget = Extension.MarkAttr({
  type: "missingLink",
  attr: "href",
  default: null,
})

expectTypeOf<Editor.FinalValidation<typeof missingMarkTarget>>().toEqualTypeOf<{
  readonly extension: Editor.Diagnostic<"MissingMarkTarget", {
    readonly type: "missingLink"
    readonly attr: "href"
  }>
}>()

// @ts-expect-error Final Validation rejects mark attrs without a target mark spec.
Editor.layer({ extension: missingMarkTarget })

// @ts-expect-error Final Validation rejects mark attrs without a target mark spec.
Editor.make({ extension: missingMarkTarget })

// @ts-expect-error Final Validation rejects mark attrs without a target mark spec.
Editor.createEditor({ extension: missingMarkTarget })

const missingTargets = Extension.union(missingNodeTarget, missingMarkTarget)

expectTypeOf<Editor.FinalValidation<typeof missingTargets>>().toEqualTypeOf<{
  readonly extension:
    | Editor.Diagnostic<"MissingNodeTarget", {
        readonly type: "missingParagraph"
        readonly attr: "textAlign"
      }>
    | Editor.Diagnostic<"MissingMarkTarget", {
        readonly type: "missingLink"
        readonly attr: "href"
      }>
}>()

const forwardReference = Extension.union(
  Extension.NodeAttr({
    type: "paragraph",
    attr: "textAlign",
    default: null,
  }),
  Extension.NodeSpec({
    name: "paragraph",
    content: "inline*",
  }),
)

expectTypeOf<Editor.FinalValidation<typeof forwardReference>>().toEqualTypeOf<unknown>()
Editor.layer({ extension: forwardReference })
Editor.make({ extension: forwardReference })
Editor.createEditor({ extension: forwardReference })
