import type { Pipeable } from "effect/Pipeable"

import type { Priority } from "./Priority.js"

export interface Extension<Spec = unknown> extends Pipeable {
  readonly _tag: "Extension"
  readonly spec: Spec
}

export const union = <const Extensions extends readonly Extension[]>(
  ...extensions: Extensions
): Extension<{ readonly extensions: Extensions }> => ({
  _tag: "Extension",
  spec: { extensions },
  pipe() {
    throw new Error("Extension.pipe is not implemented yet")
  },
})

export const priority =
  (priority: Priority) =>
  <Spec>(extension: Extension<Spec>): Extension<{ readonly extension: Extension<Spec>; readonly priority: Priority }> => ({
    _tag: "Extension",
    spec: { extension, priority },
    pipe() {
      throw new Error("Extension.pipe is not implemented yet")
    },
  })
