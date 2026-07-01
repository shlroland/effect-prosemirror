import { describe, expect, it } from "vitest"

import * as Extension from "../../src/core/Extension.js"
import { Priority } from "../../src/core/Priority.js"
import * as EditorSchema from "../../src/core/EditorSchema.js"

describe("EditorSchema", () => {
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

    const schema = EditorSchema.collect(extension)

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

    const schema = EditorSchema.collect(extension)

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

    const schema = EditorSchema.collect(extension)

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

    const schema = EditorSchema.collect(extension)

    expect(schema.nodes.paragraph?.content).toBe("inline*")
  })

  it("merges node attrs into their target node specs", () => {
    const extension = Extension.union(
      Extension.NodeSpec({
        name: "paragraph",
        attrs: {
          id: { default: null },
        },
      }),
      Extension.NodeAttr({
        type: "paragraph",
        attr: "textAlign",
        spec: { default: "left" },
      }),
    )

    const schema = EditorSchema.collect(extension)

    expect(schema.nodes.paragraph?.attrs).toEqual({
      id: { default: null },
      textAlign: { default: "left" },
    })
    expect(schema.diagnostics).toEqual([])
  })

  it("merges mark attrs into their target mark specs", () => {
    const extension = Extension.union(
      Extension.MarkSpec({
        name: "link",
        attrs: {
          href: { default: null },
        },
      }),
      Extension.MarkAttr({
        type: "link",
        attr: "title",
        spec: { default: null },
      }),
    )

    const schema = EditorSchema.collect(extension)

    expect(schema.marks.link?.attrs).toEqual({
      href: { default: null },
      title: { default: null },
    })
    expect(schema.diagnostics).toEqual([])
  })

  it("allows attr contributions to forward-reference later specs", () => {
    const extension = Extension.union(
      Extension.NodeAttr({
        type: "paragraph",
        attr: "textAlign",
        spec: { default: null },
      }),
      Extension.NodeSpec({
        name: "paragraph",
        content: "inline*",
      }),
    )

    const schema = EditorSchema.collect(extension)

    expect(schema.nodes.paragraph?.attrs).toEqual({
      textAlign: { default: null },
    })
    expect(schema.diagnostics).toEqual([])
  })

  it("reports missing attr targets as diagnostics", () => {
    const extension = Extension.union(
      Extension.NodeAttr({
        type: "missingNode",
        attr: "textAlign",
        spec: { default: null },
      }),
      Extension.MarkAttr({
        type: "missingMark",
        attr: "href",
        spec: { default: null },
      }),
    )

    const schema = EditorSchema.collect(extension)

    expect(schema.diagnostics).toEqual([
      { _tag: "MissingNodeTarget", type: "missingNode", attr: "textAlign" },
      { _tag: "MissingMarkTarget", type: "missingMark", attr: "href" },
    ])
  })

  it("creates a ProseMirror schema from collected node and mark specs", () => {
    const extension = Extension.union(
      Extension.NodeSpec({
        name: "doc",
        content: "block+",
      }),
      Extension.NodeSpec({
        name: "paragraph",
        content: "inline*",
        group: "block",
      }),
      Extension.NodeSpec({
        name: "text",
        group: "inline",
      }),
      Extension.MarkSpec({
        name: "link",
        attrs: {
          href: { default: null },
        },
      }),
      Extension.NodeAttr({
        type: "paragraph",
        attr: "textAlign",
        spec: { default: "left" },
      }),
      Extension.MarkAttr({
        type: "link",
        attr: "title",
        spec: { default: null },
      }),
    )

    const schema = EditorSchema.create(extension)

    expect(schema.nodes.doc?.name).toBe("doc")
    expect(schema.nodes.paragraph?.spec.attrs?.textAlign?.default).toBe("left")
    expect(schema.marks.link?.spec.attrs?.href?.default).toBeNull()
    expect(schema.marks.link?.spec.attrs?.title?.default).toBeNull()
  })

  it("throws missing schema target errors when creating a ProseMirror schema", () => {
    const extension = Extension.union(
      Extension.NodeAttr({
        type: "missingNode",
        attr: "textAlign",
        spec: { default: null },
      }),
    )

    expect(() => EditorSchema.create(extension)).toThrow(EditorSchema.MissingSchemaTargetsError)
  })

  it("wraps invalid ProseMirror schema errors", () => {
    const extension = Extension.union(
      Extension.NodeSpec({
        name: "doc",
        content: "missingNode",
      }),
      Extension.NodeSpec({
        name: "text",
        group: "inline",
      }),
    )

    expect(() => EditorSchema.create(extension)).toThrow(EditorSchema.InvalidEditorSchemaError)
  })
})
