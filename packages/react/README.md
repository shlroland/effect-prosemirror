# @effect-prosemirror/react

CSR React adapter for Effect ProseMirror. It mounts a caller-owned Editing Core and never creates or destroys that Core or its Effect Scope.

```tsx
import { Basic, EditingCore, Extension } from "effect-prosemirror"
import {
  EditorContent,
  EditorProvider,
  ReactNodeView,
  useEditor,
  useEditorState,
} from "@effect-prosemirror/react"

const core = EditingCore.create({ extension: Basic.make() })

function App() {
  return (
    <EditorProvider core={core}>
      <EditorContent />
    </EditorProvider>
  )
}
```

`useEditorState(selector)` observes Core-owned state through Core Subscription and does not require a mounted View.

Atomic React NodeViews use one local React root per native NodeView instance:

```tsx
Extension.NodeView(
  ReactNodeView.atom({
    node: "widget",
    component: Widget,
  }),
)

Extension.NodeView(
  ReactNodeView.content({
    node: "callout",
    component: Callout,
  }),
)
```

`ReactNodeView.content` keeps ProseMirror-managed `contentDOM` as a sibling outside React reconciliation.
