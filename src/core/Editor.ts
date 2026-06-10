import { Context, Effect, Layer } from "effect"

import { EditorDestroyedError } from "./Error.js"
import type { Extension } from "./Extension.js"

export interface EditorService {
  readonly _tag: "EditorService"
}

export const EditorService = Context.GenericTag<EditorService>("effect-prosemirror/EditorService")

export interface EditorOptions {
  readonly extension: Extension
  readonly element?: Element
}

const makeService = (): EditorService => ({ _tag: "EditorService" })

export const layer = (_options: EditorOptions): Layer.Layer<EditorService, EditorDestroyedError> =>
  Layer.effect(
    EditorService,
    Effect.succeed(makeService()),
  )

export const make = (options: EditorOptions): Effect.Effect<EditorService, EditorDestroyedError> =>
  Effect.succeed(makeService())

export const createEditor = (_options: EditorOptions): EditorService & { destroy(): void } => ({
  _tag: "EditorService",
  destroy() {},
})
