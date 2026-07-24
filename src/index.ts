export * from "./core.js"
export * as Basic from "./extensions/basic.js"
export * as Doc from "./extensions/doc.js"
export * as Paragraph from "./extensions/paragraph.js"
export * as Text from "./extensions/text.js"
export { createEditor } from "./createEditor.js"
export type {
  CreationError as CreateEditorError,
  CreatedEditor,
  Options as CreateEditorOptions,
} from "./createEditor.js"
