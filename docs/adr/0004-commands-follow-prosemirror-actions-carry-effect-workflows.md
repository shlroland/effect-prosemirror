# Commands follow ProseMirror; Actions carry Effect workflows

Commands keep ProseMirror's existing synchronous command contract and do not receive Effect services or editor-specific runtime context. Service-dependent, asynchronous, or custom Effect-managed workflows belong to Actions, which are a library-defined concept designed to reenter ProseMirror through synchronous editing operations.

Each public command contract is represented by a Command Tag that carries its public name and user-facing parameter tuple independently of any implementation. Public command implementations use `Command.define(tag, options)`. Its `run` creator accepts the Tag's arguments and returns a ProseMirror `Command`. Its optional `isActive` creator accepts the same arguments and returns a synchronous state predicate. Definitions are contributed through `Extension.Commands`.

Multiple implementations of one Command Tag form a synchronous chain. Higher-priority definitions run first, equal priorities preserve Extension Union declaration order, and the first definition returning `true` short-circuits the chain. `canRun` and `isActive` use `some` semantics across that ordered chain.

The Command Surface exposes Tag-driven `run`, `canRun`, and `isActive` operations. It does not generate named methods such as `commands.setHeading`, so command implementations, Keymaps, and host integrations all depend on the same Command Tag contract.

Each Editing Core's Command Surface accepts only the union of Command Tags implemented by its finalized Extension. Host code receives a compile-time error when it tries to invoke a declared Tag that the current core does not provide.

If JavaScript or unsafe TypeScript bypasses that constraint, the runtime raises an Effect `CommandNotAvailableError` rather than returning `false`. `false` is reserved for an available command that cannot handle the current editor state. After Editing Core destruction, Command Surface operations retain the separately defined lifecycle behavior and return `false`.

Exceptions from an available definition or its ProseMirror Command are wrapped in `CommandExecutionError`, with the command's public name, the `run`, `canRun`, or `isActive` operation, and the original exception as `cause`. The public boundary never leaks the raw value and does not create a separate error class for each operation.

Definitions retain ProseMirror's optional `EditorView` command parameter. Editing Core execution passes no View, while a mounted Editor Command Surface and `prosemirror-keymap` pass the real `EditorView`. View-dependent commands may return `false` before mounting and handle the same intent after mounting; the Editing Core never fakes or stores a View.

Command Tag identity is nominal at runtime. Definitions participate in the same merge only by referencing the same exported Tag. Distinct runtime Tags sharing a public name are rejected by Final Validation with a `DuplicateCommandName` diagnostic, even if their argument tuples happen to be structurally equal.
