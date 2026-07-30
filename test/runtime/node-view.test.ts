// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import {
  Editor,
  EditorMountError,
  EditingCore,
  Extension,
  FinalValidationError,
  InitialContent,
  Priority,
} from "../../src/core.js"
import * as Basic from "../../src/extensions/basic.js"

describe("NodeView", () => {
  it("reports a missing target node during Final Validation", () => {
    const extension = Extension.union(
      Basic.make(),
      Extension.NodeView({
        node: "missing",
        create: () => ({ dom: document.createElement("div") }),
      }),
    )
    const createUnsafe = EditingCore.create as (options: EditingCore.Options) => EditingCore.Any

    try {
      createUnsafe({ extension })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(FinalValidationError)
      expect((error as FinalValidationError).diagnostics).toContainEqual({
        _tag: "MissingNodeViewTarget",
        node: "missing",
      })
    }
  })

  it("mounts its custom DOM through the Editor View", async () => {
    const extension = Extension.union(
      Basic.make(),
      Extension.NodeSpec({
        name: "widget",
        group: "block",
        atom: true,
        toDOM: () => ["div", { "data-fallback": "widget" }] as const,
      }),
      Extension.NodeView({
        node: "widget",
        create: ({ node }) => {
          const dom = document.createElement("button")
          dom.textContent = `Widget: ${node.type.name}`
          return { dom }
        },
      }),
    )
    const core = EditingCore.create({
      extension,
      initialContent: InitialContent.JSON({ type: "doc", content: [{ type: "widget" }] }),
    })
    const element = document.body.appendChild(document.createElement("div"))
    const editor = Editor.mount(core, element)

    expect(editor.view.dom.querySelector("button")?.textContent).toBe("Widget: widget")
    expect(editor.view.dom.querySelector("[data-fallback=widget]")).toBeNull()

    await editor.destroy()
  })

  it("updates an existing NodeView when the Core accepts a node transaction", async () => {
    const updates: string[] = []
    let creations = 0
    const extension = Extension.union(
      Basic.make(),
      Extension.NodeSpec({
        name: "widget",
        group: "block",
        atom: true,
        attrs: { label: { default: "initial" } },
        toDOM: () => ["div"] as const,
      }),
      Extension.NodeView({
        node: "widget",
        create: ({ node }) => {
          creations += 1
          const dom = document.createElement("div")
          dom.textContent = String(node.attrs.label)
          return {
            dom,
            update: (next) => {
              dom.textContent = String(next.attrs.label)
              updates.push(String(next.attrs.label))
              return true
            },
          }
        },
      }),
    )
    const core = EditingCore.create({
      extension,
      initialContent: InitialContent.JSON({
        type: "doc",
        content: [{ type: "widget", attrs: { label: "before" } }],
      }),
    })
    const editor = Editor.mount(core, document.body.appendChild(document.createElement("div")))

    expect(core.transact(({ tr }) => tr.setNodeMarkup(0, undefined, { label: "after" }))).toBe(true)

    expect(creations).toBe(1)
    expect(updates).toEqual(["after"])
    expect(editor.view.dom.textContent).toBe("after")

    await editor.destroy()
  })

  it("replaces a NodeView that declines a Core-driven update", async () => {
    let created = 0
    let destroyed = 0
    const extension = Extension.union(
      Basic.make(),
      Extension.NodeSpec({
        name: "widget",
        group: "block",
        atom: true,
        attrs: { label: { default: "initial" } },
        toDOM: () => ["div"] as const,
      }),
      Extension.NodeView({
        node: "widget",
        create: () => {
          created += 1
          return {
            dom: document.createElement("div"),
            update: () => false,
            destroy: () => {
              destroyed += 1
            },
          }
        },
      }),
    )
    const core = EditingCore.create({
      extension,
      initialContent: InitialContent.JSON({
        type: "doc",
        content: [{ type: "widget", attrs: { label: "before" } }],
      }),
    })
    const editor = Editor.mount(core, document.body.appendChild(document.createElement("div")))

    core.transact(({ tr }) => tr.setNodeMarkup(0, undefined, { label: "after" }))

    expect({ created, destroyed }).toEqual({ created: 2, destroyed: 1 })

    await editor.destroy()
  })

  it("destroys NodeViews on unmount and recreates them on remount", async () => {
    let created = 0
    let destroyed = 0
    const extension = Extension.union(
      Basic.make(),
      Extension.NodeSpec({
        name: "widget",
        group: "block",
        atom: true,
        toDOM: () => ["div"] as const,
      }),
      Extension.NodeView({
        node: "widget",
        create: () => {
          created += 1
          return {
            dom: document.createElement("div"),
            destroy: () => {
              destroyed += 1
            },
          }
        },
      }),
    )
    const core = EditingCore.create({
      extension,
      initialContent: InitialContent.JSON({ type: "doc", content: [{ type: "widget" }] }),
    })
    const first = Editor.mount(core, document.body.appendChild(document.createElement("div")))

    first.unmount()

    expect({ created, destroyed }).toEqual({ created: 1, destroyed: 1 })

    Editor.mount(core, document.body.appendChild(document.createElement("div")))

    expect({ created, destroyed }).toEqual({ created: 2, destroyed: 1 })

    await core.destroy()

    expect({ created, destroyed }).toEqual({ created: 2, destroyed: 2 })
  })

  it("uses the highest-priority adapter for a node", async () => {
    const adapter = (text: string) =>
      Extension.NodeView({
        node: "widget",
        create: () => {
          const dom = document.createElement("div")
          dom.textContent = text
          return { dom }
        },
      })
    const extension = Extension.union(
      Basic.make(),
      Extension.NodeSpec({
        name: "widget",
        group: "block",
        atom: true,
        toDOM: () => ["div"] as const,
      }),
      adapter("low").pipe(Extension.priority(Priority.Low)),
      adapter("high").pipe(Extension.priority(Priority.High)),
    )
    const core = EditingCore.create({
      extension,
      initialContent: InitialContent.JSON({ type: "doc", content: [{ type: "widget" }] }),
    })
    const editor = Editor.mount(core, document.body.appendChild(document.createElement("div")))

    expect(editor.view.dom.textContent).toBe("high")

    await editor.destroy()
  })

  it("keeps the Core remountable when an adapter fails during construction", async () => {
    let attempts = 0
    const extension = Extension.union(
      Basic.make(),
      Extension.NodeSpec({
        name: "widget",
        group: "block",
        atom: true,
        toDOM: () => ["div"] as const,
      }),
      Extension.NodeView({
        node: "widget",
        create: () => {
          attempts += 1
          if (attempts === 1) throw new Error("first mount fails")
          return { dom: document.createElement("div") }
        },
      }),
    )
    const core = EditingCore.create({
      extension,
      initialContent: InitialContent.JSON({ type: "doc", content: [{ type: "widget" }] }),
    })

    expect(() =>
      Editor.mount(core, document.body.appendChild(document.createElement("div"))),
    ).toThrow(EditorMountError)

    const editor = Editor.mount(core, document.body.appendChild(document.createElement("div")))

    expect(attempts).toBe(2)
    expect(editor.view.dom).toBeInstanceOf(HTMLElement)

    await editor.destroy()
  })

  it("routes NodeView DOM transactions back through the Editing Core", async () => {
    const extension = Extension.union(
      Basic.make(),
      Extension.NodeSpec({
        name: "widget",
        group: "block",
        atom: true,
        attrs: { count: { default: 0 } },
        toDOM: () => ["div"] as const,
      }),
      Extension.NodeView({
        node: "widget",
        create: ({ getPos, node, view }) => {
          const dom = document.createElement("button")
          dom.textContent = String(node.attrs.count)
          dom.addEventListener("click", () => {
            const position = getPos()
            if (position === undefined) return
            view.dispatch(
              view.state.tr.setNodeMarkup(position, undefined, { count: node.attrs.count + 1 }),
            )
          })
          return { dom }
        },
      }),
    )
    const core = EditingCore.create({
      extension,
      initialContent: InitialContent.JSON({
        type: "doc",
        content: [{ type: "widget", attrs: { count: 1 } }],
      }),
    })
    const editor = Editor.mount(core, document.body.appendChild(document.createElement("div")))

    ;(editor.view.dom.querySelector("button") as HTMLButtonElement).click()

    expect(core.state.doc.firstChild?.attrs.count).toBe(2)
    expect(editor.view.state).toBe(core.state)

    await editor.destroy()
  })
})
