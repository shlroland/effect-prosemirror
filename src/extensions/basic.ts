import * as Extension from "../core/Extension.js"
import * as Doc from "./doc.js"
import * as Paragraph from "./paragraph.js"
import * as Text from "./text.js"

export const make = () => Extension.union(Doc.make(), Text.make(), Paragraph.make())
