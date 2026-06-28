import { describe, expect, it } from "vitest"

import * as Extension from "../../src/core/Extension.js"
import { Priority } from "../../src/core/Priority.js"
import * as Schema from "../../src/core/Schema.js"

describe("Schema", () => {
  it("merges same-name node specs", () => {
    const extension = Extension.union(
      Extension.NodeSpec({
        name: "paragraph",
        content: "inline*",
        attrs: {
          id: { default: null },
        },
        parseDOM: [{ tag: "p" }],
      }),
      Extension.NodeSpec({
        name: "paragraph",
        group: "block",
        attrs: {
          className: { default: null },
        },
        parseDOM: [{ tag: "section p" }],
      }),
    )

    const schema = Schema.collect(extension)

    expect(schema.nodes.paragraph).toMatchObject({
      name: "paragraph",
      content: "inline*",
      group: "block",
      attrs: {
        id: { default: null },
        className: { default: null },
      },
    })
    expect(schema.nodes.paragraph?.parseDOM).toEqual([
      { tag: "p" },
      { tag: "section p" },
    ])
  })

  it("merges same-name mark specs", () => {
    const extension = Extension.union(
      Extension.MarkSpec({
        name: "link",
        attrs: {
          href: { default: null },
        },
        parseDOM: [{ tag: "a[href]" }],
      }),
      Extension.MarkSpec({
        name: "link",
        inclusive: false,
        attrs: {
          title: { default: null },
        },
        parseDOM: [{ tag: "a[title]" }],
      }),
    )

    const schema = Schema.collect(extension)

    expect(schema.marks.link).toMatchObject({
      name: "link",
      inclusive: false,
      attrs: {
        href: { default: null },
        title: { default: null },
      },
    })
    expect(schema.marks.link?.parseDOM).toEqual([
      { tag: "a[href]" },
      { tag: "a[title]" },
    ])
  })

  it("lets later same-priority specs override ordinary fields", () => {
    const extension = Extension.union(
      Extension.NodeSpec({
        name: "paragraph",
        content: "inline*",
      }),
      Extension.NodeSpec({
        name: "paragraph",
        content: "text*",
      }),
    )

    const schema = Schema.collect(extension)

    expect(schema.nodes.paragraph?.content).toBe("text*")
  })

  it("lets higher-priority specs override lower-priority ordinary fields", () => {
    const extension = Extension.union(
      Extension.NodeSpec({
        name: "paragraph",
        content: "inline*",
      }).pipe(Extension.priority(Priority.High)),
      Extension.NodeSpec({
        name: "paragraph",
        content: "text*",
      }),
    )

    const schema = Schema.collect(extension)

    expect(schema.nodes.paragraph?.content).toBe("inline*")
  })
})
