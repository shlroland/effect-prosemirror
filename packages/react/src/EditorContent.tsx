import { useLayoutEffect, useRef, type ComponentProps } from "react"

import { Editor } from "effect-prosemirror"

import { useAdapter } from "./useAdapter.js"

export type EditorContentProps = Omit<ComponentProps<"div">, "children">

export const EditorContent = (props: EditorContentProps) => {
  const { core, setEditor } = useAdapter()
  const elementRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = elementRef.current
    if (!element) return

    const instance = Editor.mount(core, element)
    setEditor(instance)

    return () => {
      instance.unmount()
      setEditor((current) => (current === instance ? undefined : current))
    }
  }, [core, setEditor])

  return <div ref={elementRef} {...props} />
}
