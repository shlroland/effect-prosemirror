import * as Extension from "../internal/Extension.js"

export const make = () =>
  Extension.NodeSpec({
    name: "paragraph",
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: "p" }],
    toDOM: () => ["p", 0] as const,
  })
