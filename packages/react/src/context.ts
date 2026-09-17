import { createContext } from "react"

import type { Action, Command, EditingCore, Editor } from "effect-prosemirror"

export interface AdapterContextValue<
  Commands extends Command.CommandTag.Any = Command.CommandTag.Any,
  Actions extends Action.ActionTag.Any = Action.ActionTag.Any,
> {
  readonly core: EditingCore.Core<Commands, Actions>
  readonly editor: Editor.Editor<Commands, Actions> | undefined
  readonly setEditor: (
    editor:
      | Editor.Editor<Commands, Actions>
      | undefined
      | ((
          current: Editor.Editor<Commands, Actions> | undefined,
        ) => Editor.Editor<Commands, Actions> | undefined),
  ) => void
}

export const AdapterContext = createContext<AdapterContextValue | null>(null)
