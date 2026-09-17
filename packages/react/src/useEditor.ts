import type { Action, Command, Editor } from "effect-prosemirror"

import { useAdapter } from "./useAdapter.js"

export const useEditor = <
  Commands extends Command.CommandTag.Any = Command.CommandTag.Any,
  Actions extends Action.ActionTag.Any = Action.ActionTag.Any,
>(): Editor.Editor<Commands, Actions> | undefined =>
  useAdapter().editor as Editor.Editor<Commands, Actions> | undefined
