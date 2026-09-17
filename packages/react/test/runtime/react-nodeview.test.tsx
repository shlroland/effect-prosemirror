// @vitest-environment jsdom

import { useEffect, type ComponentType } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { Basic, EditingCore, Editor, Extension, InitialContent, NodeView } from "effect-prosemirror"

import { ReactNodeView } from "../../src/index.js"

const Label = ({ node }: NodeView.Context) => (
  <span data-testid="widget">{String(node.attrs.label)}</span>
)

const Counter = ({ node, view, getPos }: NodeView.Context) => (
  <button
    type="button"
    onClick={() => {
      const position = getPos()
      if (position === undefined) return
      view.dispatch(
        view.state.tr.setNodeMarkup(position, undefined, {
          count: Number(node.attrs.count) + 1,
        }),
      )
    }}
  >
    {String(node.attrs.count)}
  </button>
)

const labeledWidget = (component: ComponentType<NodeView.Context>) =>
  Extension.union(
    Basic.make(),
    Extension.NodeSpec({
      name: "widget",
      group: "block",
      atom: true,
      attrs: { label: { default: "hello" } },
      toDOM: () => ["div"] as const,
    }),
    Extension.NodeView(ReactNodeView.atom({ node: "widget", component })),
  )

afterEach(() => {
  document.body.replaceChildren()
})

describe("React NodeView Renderer", () => {
  it("renders an atomic schema node through a local React root", async () => {
    const core = EditingCore.create({
      extension: labeledWidget(Label),
      initialContent: InitialContent.JSON({
        type: "doc",
        content: [{ type: "widget", attrs: { label: "hello" } }],
      }),
    })
    const editor = Editor.mount(core, document.body.appendChild(document.createElement("div")))

    expect(editor.view.dom.querySelector("[data-testid=widget]")?.textContent).toBe("hello")

    await editor.destroy()
  })

  it("rerenders the same React root when Core updates node attributes", async () => {
    const core = EditingCore.create({
      extension: labeledWidget(Label),
      initialContent: InitialContent.JSON({
        type: "doc",
        content: [{ type: "widget", attrs: { label: "before" } }],
      }),
    })
    const editor = Editor.mount(core, document.body.appendChild(document.createElement("div")))
    const reactDOM = editor.view.dom.querySelector("[data-testid=widget]")?.parentElement

    expect(core.transact(({ tr }) => tr.setNodeMarkup(0, undefined, { label: "after" }))).toBe(true)

    const next = editor.view.dom.querySelector("[data-testid=widget]")
    expect(next?.textContent).toBe("after")
    expect(next?.parentElement).toBe(reactDOM)

    await editor.destroy()
  })

  it("submits a React interaction through the Core-owned transaction path", async () => {
    const core = EditingCore.create({
      extension: Extension.union(
        Basic.make(),
        Extension.NodeSpec({
          name: "widget",
          group: "block",
          atom: true,
          attrs: { count: { default: 0 } },
          toDOM: () => ["div"] as const,
        }),
        Extension.NodeView(ReactNodeView.atom({ node: "widget", component: Counter })),
      ),
      initialContent: InitialContent.JSON({
        type: "doc",
        content: [{ type: "widget", attrs: { count: 1 } }],
      }),
    })
    const editor = Editor.mount(core, document.body.appendChild(document.createElement("div")))
    const button = editor.view.dom.querySelector("button")

    expect(button).not.toBeNull()
    button?.click()

    expect(core.state.doc.firstChild?.attrs.count).toBe(2)
    expect(editor.view.state).toBe(core.state)
    expect(button?.textContent).toBe("2")

    await editor.destroy()
  })

  it("unmounts the React root exactly once when ProseMirror destroys the NodeView", async () => {
    let unmounts = 0
    const Tracked = () => {
      useEffect(
        () => () => {
          unmounts += 1
        },
        [],
      )
      return <span>tracked</span>
    }
    const core = EditingCore.create({
      extension: labeledWidget(Tracked),
      initialContent: InitialContent.JSON({ type: "doc", content: [{ type: "widget" }] }),
    })
    const editor = Editor.mount(core, document.body.appendChild(document.createElement("div")))

    expect(unmounts).toBe(0)
    editor.unmount()
    expect(unmounts).toBe(1)

    Editor.mount(core, document.body.appendChild(document.createElement("div")))
    expect(unmounts).toBe(1)

    await core.destroy()
    expect(unmounts).toBe(2)
  })
})
