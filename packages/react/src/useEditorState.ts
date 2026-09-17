import type { EditorState } from "prosemirror-state"
import { useCallback, useRef, useSyncExternalStore } from "react"

import { useAdapter } from "./useAdapter.js"

export const useEditorState = <Selected>(selector: (state: EditorState) => Selected): Selected => {
  const { core } = useAdapter()
  const selectorRef = useRef(selector)
  selectorRef.current = selector
  const cacheRef = useRef<{ state: EditorState; selected: Selected } | undefined>(undefined)

  const subscribe = useCallback(
    (onStoreChange: () => void) => core.subscribe(onStoreChange),
    [core],
  )

  const getSnapshot = useCallback(() => {
    const state = core.state
    const cache = cacheRef.current
    if (cache && cache.state === state) return cache.selected

    const selected = selectorRef.current(state)
    if (cache && Object.is(cache.selected, selected)) {
      cacheRef.current = { state, selected: cache.selected }
      return cache.selected
    }

    cacheRef.current = { state, selected }
    return selected
  }, [core])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
