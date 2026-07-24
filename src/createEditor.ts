import { Effect } from "effect"

import type { CommandTag } from "./internal/Command.js"
import * as EditingCore from "./internal/editing-core/EditingCore.js"
import * as EditorInstance from "./internal/Editor.js"
import type { EditorMountError } from "./internal/Error.js"
import type { Extension } from "./internal/Extension.js"

export type Options<ExtensionValue extends Extension.Any = Extension.Any> =
  EditingCore.CreateOptions<ExtensionValue> & {
    readonly element: Element
  }

export type CreationError = EditingCore.CreationError | EditorMountError

export const createEditor = <const ExtensionValue extends Extension.Any>(
  options: Options<ExtensionValue>,
): EditorInstance.Editor<EditingCore.AvailableCommandTags<ExtensionValue>> => {
  const core = (EditingCore.create as Function)(options) as EditingCore.Core<
    EditingCore.AvailableCommandTags<ExtensionValue>
  >

  try {
    return EditorInstance.mount(core, options.element)
  } catch (error) {
    // Core destruction invalidates synchronously; its asynchronous cleanup cannot replace mount failure.
    void Effect.runPromiseExit(Effect.promise(() => core.destroy()))
    throw error
  }
}

export type CreatedEditor<Available extends CommandTag.Any = CommandTag.Any> =
  EditorInstance.Editor<Available>
