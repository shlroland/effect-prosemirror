import { expectTypeOf } from "expect-type"

import { Basic, EditingCore, Editor } from "effect-prosemirror"

import { EditorContent, EditorProvider, useEditor, useEditorState } from "../../src/index.js"

const core = EditingCore.create({ extension: Basic.make() })

expectTypeOf(EditorProvider).toBeFunction()
expectTypeOf(EditorContent).toBeFunction()

const editor = useEditor()
expectTypeOf(editor).toEqualTypeOf<Editor.Any | undefined>()

expectTypeOf(useEditorState((state) => state.doc.textContent)).toEqualTypeOf<string>()
expectTypeOf(useEditorState((state) => state.selection.from)).toEqualTypeOf<number>()

void core
