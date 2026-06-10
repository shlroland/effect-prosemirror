import { Data } from "effect"

export class EditorDestroyedError extends Data.TaggedError("EditorDestroyedError")<{}> {}

export type EditorError = EditorDestroyedError
