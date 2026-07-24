# Public Runtime Failures Use Effect Errors

Every public runtime failure is represented as an Effect `Data.TaggedError`, including schema creation, Initial Content decoding, command execution boundaries, and future editor lifecycle failures. The library may retain the original ProseMirror error as a `cause`, but it never directly throws a raw ProseMirror exception. Effect-returning construction APIs expose these values through their error channel; direct synchronous ProseMirror-oriented commands, queries, and transaction operations throw the same tagged values rather than being duplicated as Effect-returning operations.

Initial Content construction distinguishes `InitialContentDocumentUnavailableError`, `InvalidInitialContentError`, and `InitialContentCreationError`, so unavailable browser infrastructure, invalid explicit content, and an uncreatable default top node remain independently recoverable.

At a complete Editing Core boundary, Final Validation failures are reported as one `FinalValidationError` containing every discovered typed diagnostic instead of a fail-fast raw or generic exception.

An unavailable Command Tag is reported as `CommandNotAvailableError`, not as the normal boolean `false` result used when an available command declines the current state. The idempotent destroyed-core behavior remains a deliberate exception: Command Surface operations return `false` after destruction.

Failures raised by available Command Definitions are reported uniformly as `CommandExecutionError`, which includes the command name, the `run`, `canRun`, or `isActive` operation, and the original value as `cause`.

Operations attempted through an unmounted Editor Instance fail with `EditorUnmountedError`. The stale handle never silently falls back to core-only execution or retargets a later mount.

An exception while destroying a View during an explicit `editor.unmount()` is reported as `EditorUnmountError { cause }`. Core destruction reports the same class of failure through its asynchronous `EditorDestructionError { cause }` completion instead of throwing synchronously.

A mounted View that cannot reflect an accepted core state is detached and reported through `EditorViewSynchronizationError { cause }`; raw plugin or DOM exceptions do not cross the adapter boundary.

EditorView or plugin View initialization failures are reported as `EditorMountError { cause }` after partial mount cleanup. `EditorDestroyedError` and `EditorAlreadyMountedError` remain distinct lifecycle failures.

Nested public writes during a synchronous Transaction Boundary fail with `TransactionReentryError`; the library does not allow an inner write to make the outer callback's transaction stale.

Exceptions in a Transaction Boundary's callback or ProseMirror `applyTransaction` phase become `TransactionExecutionError`, with `phase: "callback" | "apply"` and the original value as `cause`. `TransactionReentryError` remains distinct.
