import { useMemo, useState, type ReactNode } from "react"

import type { Action, Command, EditingCore, Editor } from "effect-prosemirror"

import { AdapterContext } from "./context.js"

export interface EditorProviderProps<
  Commands extends Command.CommandTag.Any = Command.CommandTag.Any,
  Actions extends Action.ActionTag.Any = Action.ActionTag.Any,
> {
  readonly core: EditingCore.Core<Commands, Actions>
  readonly children?: ReactNode
}

export const EditorProvider = <
  Commands extends Command.CommandTag.Any,
  Actions extends Action.ActionTag.Any,
>({
  core,
  children,
}: EditorProviderProps<Commands, Actions>) => {
  const [editor, setEditor] = useState<Editor.Editor<Commands, Actions> | undefined>(undefined)
  const value = useMemo(() => ({ core, editor, setEditor }), [core, editor, setEditor])

  return <AdapterContext.Provider value={value}>{children}</AdapterContext.Provider>
}
