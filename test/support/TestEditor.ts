import { Editor, type Extension as ExtensionModule } from "../../src/core.js"

import { createTestCore, type TestCore } from "./TestCore.js"

export interface TestEditor extends TestCore {
  readonly editor: Editor.Any
  readonly inputText: (text: string) => void
}

export const createTestEditor = <ExtensionValue extends ExtensionModule.Extension.Any>(options: {
  readonly extension: ExtensionValue
}): TestEditor => {
  const test = createTestCore(options)
  const editor = Editor.mount(test.core, document.createElement("div"))

  return {
    ...test,
    editor,
    inputText: (text) => {
      for (const character of text) {
        const { from, to } = editor.state.selection
        const defaultInsert = () => editor.state.tr.insertText(character, from, to)
        const handled = editor.view.someProp("handleTextInput", (handler) =>
          handler(editor.view, from, to, character, defaultInsert),
        )

        if (!handled) editor.view.dispatch(defaultInsert())
      }
    },
  }
}
