# @effect-prosemirror/react

CSR React adapter for Effect ProseMirror. It mounts a caller-owned Editing Core and never creates or destroys that Core or its Effect Scope.

```tsx
import { Basic, EditingCore } from "effect-prosemirror"
import { EditorContent, EditorProvider, useEditor, useEditorState } from "@effect-prosemirror/react"

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
