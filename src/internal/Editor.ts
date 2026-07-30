import type { Schema } from "prosemirror-model"
import type { EditorState, Transaction } from "prosemirror-state"
import { EditorView } from "prosemirror-view"

import type { ActionTag } from "./Action.js"
import type { CommandTag } from "./Command.js"
import * as EditingCore from "./editing-core/EditingCore.js"
import {
  EditorMountError,
  EditorUnmountError,
  EditorUnmountedError,
  type EditorError,
} from "./Error.js"
import * as KeymapPlugin from "./KeymapPlugin.js"
import * as NodeView from "./NodeView.js"

export interface TransactionContext extends EditingCore.MountedTransactionContext {}

export type Transact = (callback: (context: TransactionContext) => Transaction | false) => boolean

export interface Editor<
  AvailableCommands extends CommandTag.Any = CommandTag.Any,
  AvailableActions extends ActionTag.Any = ActionTag.Any,
> {
  readonly _tag: "Editor"
  readonly core: EditingCore.Core<AvailableCommands, AvailableActions>
  readonly view: EditorView
  readonly state: EditorState
  readonly schema: Schema
  readonly commands: EditingCore.CommandSurface<AvailableCommands>
  readonly actions: EditingCore.ActionSurface<AvailableActions>
  readonly transact: Transact
  readonly unmount: () => void
  readonly destroy: () => Promise<void>
}

export type Any = Editor<CommandTag.Any, ActionTag.Any>

export const mount = <
  AvailableCommands extends CommandTag.Any,
  AvailableActions extends ActionTag.Any,
>(
  core: EditingCore.Core<AvailableCommands, AvailableActions>,
  element: Element,
): Editor<AvailableCommands, AvailableActions> => {
  let mounted = true
  let view: EditorView | undefined

  const binding = EditingCore.bindView(core, {
    getView: () => view,
    updateState: (state) => view?.updateState(state),
    destroyView: () => {
      const current = view
      view = undefined
      mounted = false
      current?.destroy()
    },
  })

  try {
    view = new EditorView(element, {
      state: binding.state,
      plugins: [KeymapPlugin.create(core.keymap, binding.commands)],
      nodeViews: NodeView.constructors(binding.nodeViews),
      dispatchTransaction: binding.dispatchTransaction,
    })
  } catch (cause) {
    try {
      binding.unmount()
    } catch {
      // The View construction failure is the public mount failure.
    }
    throw new EditorMountError({ cause })
  }

  const assertMounted = (): EditorView => {
    void core.state
    if (!mounted || !view) throw new EditorUnmountedError()
    return view
  }

  const commands: EditingCore.CommandSurface<AvailableCommands> = {
    run: (tag, ...args) => {
      assertMounted()
      return binding.commands.run(tag, ...args)
    },
    canRun: (tag, ...args) => {
      assertMounted()
      return binding.commands.canRun(tag, ...args)
    },
    isActive: (tag, ...args) => {
      assertMounted()
      return binding.commands.isActive(tag, ...args)
    },
  }

  const actions: EditingCore.ActionSurface<AvailableActions> = {
    run: (tag, ...args) => {
      assertMounted()
      return core.actions.run(tag, ...args)
    },
  }

  return {
    _tag: "Editor",
    core,
    get view() {
      return assertMounted()
    },
    get state() {
      assertMounted()
      return core.state
    },
    get schema() {
      assertMounted()
      return core.schema
    },
    commands,
    actions,
    transact: (callback) => {
      assertMounted()
      return binding.transact(callback)
    },
    unmount: () => {
      if (!mounted) return
      try {
        binding.unmount()
      } catch (cause) {
        throw new EditorUnmountError({ cause })
      }
    },
    destroy: () => core.destroy(),
  }
}

export type { Diagnostic, FinalValidation } from "./editing-core/EditingCore.js"
export type { EditorError }
