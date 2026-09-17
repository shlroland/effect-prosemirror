import { expectTypeOf } from "expect-type"

import { Basic, EditingCore, Editor } from "effect-prosemirror"

import { EditorContent, EditorProvider, useEditor } from "../../src/index.js"

const core = EditingCore.create({ extension: Basic.make() })

expectTypeOf(EditorProvider).toBeFunction()
expectTypeOf(EditorContent).toBeFunction()

const editor = useEditor()
expectTypeOf(editor).toEqualTypeOf<Editor.Any | undefined>()

void core
