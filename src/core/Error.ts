import { Data } from "effect"

export interface MissingNodeTargetDiagnostic {
  readonly _tag: "MissingNodeTarget"
  readonly type: string
  readonly attr: string
}

export interface MissingMarkTargetDiagnostic {
  readonly _tag: "MissingMarkTarget"
  readonly type: string
  readonly attr: string
}

export interface DuplicateCommandNameDiagnostic {
  readonly _tag: "DuplicateCommandName"
  readonly command: string
}

export interface MissingCommandImplementationDiagnostic {
  readonly _tag: "MissingCommandImplementation"
  readonly command: string
}

export type FinalValidationDiagnostic =
  | MissingNodeTargetDiagnostic
  | MissingMarkTargetDiagnostic
  | DuplicateCommandNameDiagnostic
  | MissingCommandImplementationDiagnostic

export class FinalValidationError extends Data.TaggedError("FinalValidationError")<{
  readonly diagnostics: readonly FinalValidationDiagnostic[]
}> {}

export class InitialContentDocumentUnavailableError extends Data.TaggedError(
  "InitialContentDocumentUnavailableError",
)<{}> {}

export class InvalidInitialContentError extends Data.TaggedError("InvalidInitialContentError")<{
  readonly source: "Node" | "JSON" | "HTML"
  readonly reason: "SchemaMismatch" | "InvalidDocument"
  readonly cause?: unknown
}> {}

export class InitialContentCreationError extends Data.TaggedError("InitialContentCreationError")<{
  readonly reason: "TopNodeCannotCreateAndFill"
}> {}

export class InvalidKeyError extends Data.TaggedError("InvalidKeyError")<{
  readonly value: unknown
  readonly reason: "NotSinglePrintableCharacter" | "InvalidFunctionKey"
}> {}

export class CommandNotAvailableError extends Data.TaggedError("CommandNotAvailableError")<{
  readonly command: string
}> {}

export class CommandExecutionError extends Data.TaggedError("CommandExecutionError")<{
  readonly command: string
  readonly operation: "run" | "canRun" | "isActive"
  readonly cause: unknown
}> {}

export class TransactionReentryError extends Data.TaggedError("TransactionReentryError")<{}> {}

export class TransactionExecutionError extends Data.TaggedError("TransactionExecutionError")<{
  readonly phase: "callback" | "apply"
  readonly cause: unknown
}> {}

export class EditorDestroyedError extends Data.TaggedError("EditorDestroyedError")<{}> {}

export class EditorDestructionError extends Data.TaggedError("EditorDestructionError")<{
  readonly cause: unknown
}> {}

export type EditingCoreError =
  | FinalValidationError
  | InitialContentDocumentUnavailableError
  | InvalidInitialContentError
  | InitialContentCreationError
  | InvalidKeyError
  | CommandNotAvailableError
  | CommandExecutionError
  | TransactionReentryError
  | TransactionExecutionError
  | EditorDestroyedError
  | EditorDestructionError

export type EditorError = EditingCoreError
