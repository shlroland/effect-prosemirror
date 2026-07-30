import { InputRule } from "prosemirror-inputrules"

export const make = (options: { readonly match: RegExp; readonly mark: string }): InputRule =>
  new InputRule(
    options.match,
    (state, match, start, end) => {
      const [fullText, markedText] = match
      if (!markedText) return null

      const markStart = start + fullText.indexOf(markedText)
      const markEnd = markStart + markedText.length
      if (!(start <= markStart && markStart < markEnd && markEnd <= end)) return null

      const markType = state.schema.marks[options.mark]
      if (!markType || state.doc.rangeHasMark(markStart, markEnd, markType)) return null

      const initialStoredMarks = state.tr.storedMarks ?? []
      const transaction = state.tr.addMark(markStart, markEnd, markType.create())

      if (markEnd < end) transaction.delete(markEnd, end)
      if (start < markStart) transaction.delete(start, markStart)

      return transaction.setStoredMarks(initialStoredMarks)
    },
    { inCodeMark: false },
  )
