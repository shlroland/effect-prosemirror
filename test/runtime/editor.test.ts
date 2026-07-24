// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  Command,
  CommandInvocation,
  EditingCore,
  Editor,
  EditorAlreadyMountedError,
  EditorDestructionError,
  EditorDestroyedError,
  EditorMountError,
  EditorUnmountError,
  EditorUnmountedError,
  EditorViewSynchronizationError,
  Extension,
  Key,
  KeyChord,
  Keymap,
  Priority,
} from "../../src/core.js"
import { createEditor } from "../../src/index.js"

const schemaExtension = Extension.union(
  Extension.NodeSpec({ name: "doc", content: "paragraph+", toDOM: () => ["div", 0] as const }),
  Extension.NodeSpec({ name: "paragraph", content: "text*", toDOM: () => ["p", 0] as const }),
  Extension.NodeSpec({ name: "text" }),
)

class InsertText extends Command.Tag("insertText")<InsertText, [text: string]>() {}
class RequireView extends Command.Tag("requireView")<RequireView, []>() {}
class HighPriorityShortcut extends Command.Tag("highPriorityShortcut")<
  HighPriorityShortcut,
  []
>() {}
class LowPriorityShortcut extends Command.Tag("lowPriorityShortcut")<LowPriorityShortcut, []>() {}
class UnhandledShortcut extends Command.Tag("unhandledShortcut")<UnhandledShortcut, []>() {}
class DetachedShortcut extends Command.Tag("detachedShortcut")<DetachedShortcut, []>() {}
let receivedView: unknown

const insertText = Command.define(InsertText, {
  run: (text) => (state, dispatch) => {
    dispatch?.(state.tr.insertText(text))
    return true
  },
})

const requireView = Command.define(RequireView, {
  run: () => (_state, _dispatch, view) => {
    receivedView = view
    return !!view
  },
})

const extension = Extension.union(schemaExtension, Extension.Commands(insertText, requireView))

const shortcutChord = KeyChord.make({
  modifiers: [KeyChord.Modifier.Mod, KeyChord.Modifier.Alt],
  key: Key.Digit(1),
})

const shortcutEvent = (): KeyboardEvent =>
  new KeyboardEvent("keydown", {
    key: "1",
    ...(/Mac|iP(hone|[oa]d)/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true }),
    altKey: true,
    bubbles: true,
    cancelable: true,
  })

const mounted = () => {
  const core = EditingCore.create({ extension })
  const element = document.body.appendChild(document.createElement("div"))
  return { core, editor: Editor.mount(core, element), element }
}

afterEach(() => {
  document.body.replaceChildren()
  receivedView = undefined
  vi.restoreAllMocks()
})

describe("Editor.mount", () => {
  it("creates and mounts an internally owned Core", async () => {
    const editor = createEditor({
      extension,
      element: document.body.appendChild(document.createElement("div")),
    })

    expect(editor.core.commands.run(InsertText, "created")).toBe(true)
    expect(editor.state.doc.textContent).toBe("created")
    expect(editor.view.state).toBe(editor.core.state)

    await editor.destroy()
  })

  it("preserves mount failure while rolling back an internally owned Core", () => {
    expect(() => createEditor({ extension, element: { mount: {} } as unknown as Element })).toThrow(
      EditorMountError,
    )
  })

  it("executes same-chord bindings by priority and stops when one handles the key", async () => {
    const calls: string[] = []
    const high = Command.define(HighPriorityShortcut, {
      run: () => () => {
        calls.push("high")
        return false
      },
    })
    const low = Command.define(LowPriorityShortcut, {
      run: () => (state, dispatch) => {
        calls.push("low")
        dispatch?.(state.tr.insertText("shortcut"))
        return true
      },
    })
    const core = EditingCore.create({
      extension: Extension.union(
        schemaExtension,
        Extension.Commands(low),
        Extension.Keymap(
          Keymap.bind(shortcutChord, CommandInvocation.make(LowPriorityShortcut)),
        ).pipe(Extension.priority(Priority.Low)),
        Extension.Commands(high),
        Extension.Keymap(
          Keymap.bind(shortcutChord, CommandInvocation.make(HighPriorityShortcut)),
        ).pipe(Extension.priority(Priority.High)),
      ),
    })
    const editor = Editor.mount(core, document.body.appendChild(document.createElement("div")))

    const handled = editor.view.dom.dispatchEvent(shortcutEvent())

    expect(handled).toBe(false)
    expect(calls).toEqual(["high", "low"])
    expect(editor.state.doc.textContent).toBe("shortcut")

    await core.destroy()
  })

  it("leaves a shortcut unhandled when every binding returns false", async () => {
    const unhandled = Command.define(UnhandledShortcut, {
      run: () => () => false,
    })
    const core = EditingCore.create({
      extension: Extension.union(
        schemaExtension,
        Extension.Commands(unhandled),
        Extension.Keymap(Keymap.bind(shortcutChord, CommandInvocation.make(UnhandledShortcut))),
      ),
    })
    const editor = Editor.mount(core, document.body.appendChild(document.createElement("div")))

    const handled = editor.view.dom.dispatchEvent(shortcutEvent())

    expect(handled).toBe(true)

    await core.destroy()
  })

  it("removes shortcut listeners when the View is unmounted", async () => {
    let calls = 0
    const detached = Command.define(DetachedShortcut, {
      run: () => () => {
        calls += 1
        return true
      },
    })
    const core = EditingCore.create({
      extension: Extension.union(
        schemaExtension,
        Extension.Commands(detached),
        Extension.Keymap(Keymap.bind(shortcutChord, CommandInvocation.make(DetachedShortcut))),
      ),
    })
    const editor = Editor.mount(core, document.body.appendChild(document.createElement("div")))
    const dom = editor.view.dom

    editor.unmount()
    const handled = dom.dispatchEvent(shortcutEvent())

    expect(handled).toBe(true)
    expect(calls).toBe(0)

    await core.destroy()
  })

  it("creates a View synchronized with the Core and routes View dispatch through it", async () => {
    const { core, editor } = mounted()

    expect(editor.view.state).toBe(core.state)
    editor.view.dispatch(editor.view.state.tr.insertText("from view"))

    expect(core.state.doc.textContent).toBe("from view")
    expect(editor.view.state).toBe(core.state)

    await core.destroy()
  })

  it("projects Core commands to the mounted View", async () => {
    const { core, editor } = mounted()

    expect(core.commands.run(InsertText, "from core")).toBe(true)

    expect(editor.state.doc.textContent).toBe("from core")
    expect(editor.view.state).toBe(core.state)

    await core.destroy()
  })

  it("supplies the real EditorView to mounted command execution", async () => {
    const { core, editor } = mounted()

    expect(core.commands.run(RequireView)).toBe(false)
    expect(editor.commands.run(RequireView)).toBe(true)
    expect(receivedView).toBe(editor.view)

    await core.destroy()
  })

  it("allows only one active mount per Core", async () => {
    const { core, editor } = mounted()
    const secondElement = document.body.appendChild(document.createElement("div"))

    expect(() => Editor.mount(core, secondElement)).toThrow(EditorAlreadyMountedError)

    editor.unmount()
    const remounted = Editor.mount(core, secondElement)
    expect(remounted.view).toBeInstanceOf(Object)

    await core.destroy()
  })

  it("unmounts idempotently, leaves the Core live, and permanently stales its handle", async () => {
    const { core, editor } = mounted()
    const remountElement = document.body.appendChild(document.createElement("div"))

    editor.unmount()
    editor.unmount()

    expect(() => editor.view).toThrow(EditorUnmountedError)
    expect(() => editor.state).toThrow(EditorUnmountedError)
    expect(() => editor.commands.run(InsertText, "ignored")).toThrow(EditorUnmountedError)
    expect(() => editor.transact(({ tr }) => tr.insertText("ignored"))).toThrow(
      EditorUnmountedError,
    )
    expect(core.commands.run(InsertText, "still live")).toBe(true)

    const remounted = Editor.mount(core, remountElement)
    expect(remounted.state.doc.textContent).toBe("still live")
    expect(() => editor.view).toThrow(EditorUnmountedError)

    await core.destroy()
  })

  it("wraps View destruction failures during an explicit unmount", async () => {
    const { core, editor } = mounted()
    const cause = new Error("destroy failed")
    vi.spyOn(editor.view, "destroy").mockImplementation(() => {
      throw cause
    })

    expect(() => editor.unmount()).toThrow(EditorUnmountError)
    expect(() => editor.view).toThrow(EditorUnmountedError)
    expect(core.commands.run(InsertText, "still live")).toBe(true)

    await core.destroy()
  })

  it("destroys the active View when its Core is destroyed", async () => {
    const { core, editor, element } = mounted()

    await core.destroy()

    expect(element.childElementCount).toBe(0)
    expect(() => editor.view).toThrow(EditorDestroyedError)
    expect(() => Editor.mount(core, document.createElement("div"))).toThrow(EditorDestroyedError)
  })

  it("reports active View destruction failures through the destroy Promise", async () => {
    const { core, editor } = mounted()
    const cause = new Error("destroy failed")
    vi.spyOn(editor.view, "destroy").mockImplementation(() => {
      throw cause
    })

    const destruction = core.destroy()

    expect(core.destroy()).toBe(destruction)
    await expect(destruction).rejects.toMatchObject({
      _tag: "EditorDestructionError",
      cause,
    } satisfies Partial<EditorDestructionError>)
    expect(() => core.state).toThrow(EditorDestroyedError)
  })

  it("wraps View construction failures and releases the mount reservation", async () => {
    const core = EditingCore.create({ extension })

    try {
      expect(() => Editor.mount(core, { mount: {} } as unknown as Element)).toThrow(
        EditorMountError,
      )

      const editor = Editor.mount(core, document.body.appendChild(document.createElement("div")))
      expect(editor.view).toBeInstanceOf(Object)
    } finally {
      await core.destroy()
    }
  })

  it("unmounts a View that cannot synchronize an accepted Core state", async () => {
    const { core, editor, element } = mounted()
    const cause = new Error("update failed")
    vi.spyOn(editor.view, "updateState").mockImplementation(() => {
      throw cause
    })

    try {
      core.commands.run(InsertText, "accepted")
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(EditorViewSynchronizationError)
      expect(error).toMatchObject({ cause })
    }

    expect(core.state.doc.textContent).toBe("accepted")
    expect(element.childElementCount).toBe(0)
    expect(() => editor.view).toThrow(EditorUnmountedError)

    const remounted = Editor.mount(core, document.body.appendChild(document.createElement("div")))
    expect(remounted.view.state).toBe(core.state)

    await core.destroy()
  })
})
