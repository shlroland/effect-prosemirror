import * as EffectSchema from "effect/Schema"
import { Mark } from "prosemirror-model"
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
    expect(schema.nodes.paragraph?.parseDOM).toEqual([{ tag: "p" }, { tag: "section p" }])
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
    expect(schema.marks.link?.parseDOM).toEqual([{ tag: "a[href]" }, { tag: "a[title]" }])
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

  it("wraps node parse and serialize behavior for added attrs", () => {
    const extension = Extension.union(
      Extension.NodeSpec({
        name: "paragraph",
        attrs: {
          id: { default: null },
        },
        parseDOM: [
          { tag: "p", attrs: { role: "paragraph" } },
          { tag: "p.disabled", getAttrs: () => false },
        ],
        toDOM: () => ["p", { class: "copy" }, 0],
      }),
      Extension.NodeAttr({
        type: "paragraph",
        attr: "textAlign",
        default: "left",
        parseDOM: (element) => element.getAttribute("data-align"),
        toDOM: (value) => (value ? ["data-align", String(value)] : null),
      }),
      Extension.NodeAttr({
        type: "paragraph",
        attr: "trackingId",
        default: null,
        parseDOM: (element) => element.getAttribute("data-tracking-id"),
        toDOM: (value) => (value ? ["data-tracking-id", String(value)] : null),
      }),
    )
    const schema = EditorSchema.collect(extension)
    const spec = schema.nodes.paragraph
    const element = {
      getAttribute(name: string) {
        return (
          {
            "data-align": "center",
            "data-tracking-id": "track-1",
          }[name] ?? null
        )
      },
    } as HTMLElement

    expect(spec?.parseDOM?.[0]?.getAttrs?.(element as never)).toEqual({
      role: "paragraph",
      textAlign: "center",
      trackingId: "track-1",
    })
    expect(spec?.parseDOM?.[1]?.getAttrs?.(element)).toBe(false)
    expect(
      spec?.toDOM?.({
        attrs: {
          id: null,
          textAlign: "right",
          trackingId: "track-2",
        },
      } as never),
    ).toEqual([
      "p",
      {
        class: "copy",
        "data-align": "right",
        "data-tracking-id": "track-2",
      },
      0,
    ])
  })

  it("wraps mark tag parsing and serialization without changing style rules", () => {
    const styleRule = { style: "text-decoration=line-through" } as const
    const extension = Extension.union(
      Extension.MarkSpec({
        name: "link",
        parseDOM: [
          {
            tag: "a",
            getAttrs: (element) => ({ rel: element.getAttribute("rel") }),
          },
          styleRule,
        ],
        toDOM: () => ["a", 0],
      }),
      Extension.MarkAttr({
        type: "link",
        attr: "href",
        default: null,
        parseDOM: (element) => element.getAttribute("href"),
        toDOM: (value) => (value ? ["href", String(value)] : null),
      }),
    )
    const schema = EditorSchema.collect(extension)
    const spec = schema.marks.link
    const element = {
      getAttribute(name: string) {
        return name === "href" ? "/docs" : "noopener"
      },
    } as HTMLElement

    expect(spec?.parseDOM?.[0]?.getAttrs?.(element as never)).toEqual({
      rel: "noopener",
      href: "/docs",
    })
    expect(spec?.parseDOM?.[1]).toBe(styleRule)
    expect(spec?.toDOM?.({ attrs: { href: "/guide" } } as never, true)).toEqual([
      "a",
      { href: "/guide" },
      0,
    ])
  })

  it("lets higher-priority attrs override lower-priority attr behavior", () => {
    const extension = Extension.union(
      Extension.NodeSpec({
        name: "paragraph",
        parseDOM: [{ tag: "p" }],
        toDOM: () => ["p", 0],
      }),
      Extension.NodeAttr({
        type: "paragraph",
        attr: "level",
        default: "high",
        parseDOM: () => "high",
        toDOM: () => ["data-high-level", "high"],
      }).pipe(Extension.priority(Priority.High)),
      Extension.NodeAttr({
        type: "paragraph",
        attr: "level",
        default: "low",
        parseDOM: () => "low",
        toDOM: () => ["data-low-level", "low"],
      }),
    )
    const schema = EditorSchema.collect(extension)
    const spec = schema.nodes.paragraph

    expect(spec?.attrs?.level?.default).toBe("high")
    expect(spec?.parseDOM?.[0]?.getAttrs?.({} as HTMLElement)).toEqual({ level: "high" })
    expect(spec?.toDOM?.({ attrs: { level: "ignored" } } as never)).toEqual([
      "p",
      { "data-high-level": "high" },
      0,
    ])
  })

  it("compares attr contribution priority with attrs declared on specs", () => {
    const extension = Extension.union(
      Extension.NodeSpec({
        name: "paragraph",
        attrs: {
          level: { default: "node-spec" },
        },
      }).pipe(Extension.priority(Priority.High)),
      Extension.NodeAttr({
        type: "paragraph",
        attr: "level",
        default: "node-attr",
      }).pipe(Extension.priority(Priority.Low)),
      Extension.MarkSpec({
        name: "link",
        attrs: {
          href: { default: "mark-spec" },
        },
      }).pipe(Extension.priority(Priority.Low)),
      Extension.MarkAttr({
        type: "link",
        attr: "href",
        default: "mark-attr",
      }).pipe(Extension.priority(Priority.High)),
    )
    const schema = EditorSchema.collect(extension)

    expect(schema.nodes.paragraph?.attrs?.level?.default).toBe("node-spec")
    expect(schema.marks.link?.attrs?.href?.default).toBe("mark-attr")
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

  it("uses Effect Schema to validate node attrs through ProseMirror", () => {
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
      Extension.NodeAttr({
        type: "paragraph",
        attr: "textAlign",
        default: "left",
        schema: EffectSchema.Literal("left", "center", "right"),
      }),
    )
    const schema = EditorSchema.create(extension)

    expect(() => schema.node("paragraph", { textAlign: "center" }).check()).not.toThrow()
    expect(() => schema.node("paragraph", { textAlign: "justify" }).check()).toThrow()
  })

  it("uses Effect Schema to validate mark attrs through ProseMirror", () => {
    const extension = Extension.union(
      Extension.NodeSpec({
        name: "doc",
        content: "text*",
      }),
      Extension.NodeSpec({
        name: "text",
        group: "inline",
      }),
      Extension.MarkSpec({
        name: "link",
      }),
      Extension.MarkAttr({
        type: "link",
        attr: "href",
        default: null,
        schema: EffectSchema.NullOr(EffectSchema.String),
      }),
    )
    const schema = EditorSchema.create(extension)

    expect(() =>
      Mark.fromJSON(schema, { type: "link", attrs: { href: "https://example.com" } }),
    ).not.toThrow()
    expect(() => Mark.fromJSON(schema, { type: "link", attrs: { href: 123 } })).toThrow()
  })

  it("keeps native ProseMirror attr validate support", () => {
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
      Extension.NodeAttr({
        type: "paragraph",
        attr: "level",
        default: 1,
        validate: "number",
      }),
    )
    const schema = EditorSchema.create(extension)

    expect(() => schema.node("paragraph", { level: 2 }).check()).not.toThrow()
    expect(() => schema.node("paragraph", { level: "2" }).check()).toThrow()
  })

  it("rejects attrs that define both schema and validate", () => {
    expect(() =>
      Extension.NodeAttr({
        type: "paragraph",
        attr: "textAlign",
        default: "left",
        validate: "string",
        schema: EffectSchema.String,
      }),
    ).toThrow(TypeError)
  })
})
