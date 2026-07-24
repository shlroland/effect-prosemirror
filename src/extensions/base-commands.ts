import * as Command from "../internal/Command.js"
import * as Extension from "../internal/Extension.js"
import { AllSelection, TextSelection } from "prosemirror-state"
import { canSplit } from "prosemirror-transform"

export class InsertText extends Command.Tag("insertText")<InsertText, [text: string]>() {}
export class DeleteSelection extends Command.Tag("deleteSelection")<DeleteSelection, []>() {}
export class SelectAll extends Command.Tag("selectAll")<SelectAll, []>() {}
export class SplitParagraph extends Command.Tag("splitParagraph")<SplitParagraph, []>() {}

const insertText = Command.define(InsertText, {
  run: (text) => (state, dispatch) => {
    if (text.length === 0) return false

    const transaction = state.tr.insertText(text)
    if (!transaction.docChanged) return false

    dispatch?.(transaction)
    return true
  },
})

const deleteSelection = Command.define(DeleteSelection, {
  run: () => (state, dispatch) => {
    if (state.selection.empty) return false

    const transaction = state.tr.deleteSelection()
    if (!transaction.docChanged) return false

    dispatch?.(transaction)
    return true
  },
})

const selectAll = Command.define(SelectAll, {
  run: () => (state, dispatch) => {
    if (state.selection instanceof AllSelection) return false

    dispatch?.(state.tr.setSelection(new AllSelection(state.doc)))
    return true
  },
})

const splitParagraph = Command.define(SplitParagraph, {
  run: () => (state, dispatch) => {
    if (!(state.selection instanceof TextSelection) || !state.selection.empty) return false

    const position = state.selection.$from.pos
    if (!canSplit(state.doc, position)) return false

    dispatch?.(state.tr.split(position))
    return true
  },
})

export const make = () => Extension.Commands(insertText, deleteSelection, selectAll, splitParagraph)
