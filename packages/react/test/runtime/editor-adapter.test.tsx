// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import { StrictMode, useState } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { BaseCommands, Basic, EditingCore, EditorDestroyedError } from "effect-prosemirror"

import { EditorContent, EditorProvider, useEditor } from "../../src/index.js"

const Probe = () => {
  const editor = useEditor()
  return <span data-testid="editor-mounted">{editor ? "yes" : "no"}</span>
}

const InsertButton = () => {
  const editor = useEditor()
  return (
    <button
      type="button"
      onClick={() => {
        editor?.commands.run(BaseCommands.InsertText, "hello")
      }}
    >
      insert
    </button>
  )
}

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

describe("React adapter", () => {
  it("mounts a Basic editor that can edit the document", async () => {
    const core = EditingCore.create({ extension: Basic.make() })

    render(
      <EditorProvider core={core}>
        <EditorContent data-testid="content" />
        <Probe />
        <InsertButton />
      </EditorProvider>,
    )

    expect(screen.getByTestId("editor-mounted").textContent).toBe("yes")
    screen.getByRole("button", { name: "insert" }).click()
    expect(core.state.doc.textContent).toBe("hello")

    await core.destroy()
  })

  it("unmounts only the Editor View and leaves a caller-owned Core remountable", async () => {
    const core = EditingCore.create({ extension: Basic.make() })

    const { unmount } = render(
      <EditorProvider core={core}>
        <EditorContent />
        <Probe />
      </EditorProvider>,
    )

    expect(screen.getByTestId("editor-mounted").textContent).toBe("yes")
    unmount()

    expect(core.commands.run(BaseCommands.InsertText, "kept")).toBe(true)
    expect(core.state.doc.textContent).toBe("kept")

    render(
      <EditorProvider core={core}>
        <EditorContent />
        <Probe />
      </EditorProvider>,
    )

    expect(screen.getByTestId("editor-mounted").textContent).toBe("yes")
    expect(core.state.doc.textContent).toBe("kept")

    await core.destroy()
  })

  it("remounts under Strict Mode without leaking an active mount", async () => {
    const core = EditingCore.create({ extension: Basic.make() })

    render(
      <StrictMode>
        <EditorProvider core={core}>
          <EditorContent />
          <Probe />
        </EditorProvider>
      </StrictMode>,
    )

    expect(screen.getByTestId("editor-mounted").textContent).toBe("yes")
    expect(core.commands.run(BaseCommands.InsertText, "strict")).toBe(true)

    await core.destroy()
  })

  it("returns undefined from useEditor before EditorContent mounts", async () => {
    const core = EditingCore.create({ extension: Basic.make() })

    render(
      <EditorProvider core={core}>
        <Probe />
      </EditorProvider>,
    )

    expect(screen.getByTestId("editor-mounted").textContent).toBe("no")
    expect(() => core.state).not.toThrow(EditorDestroyedError)

    await core.destroy()
  })

  it("does not destroy the Core when the Provider tree unmounts", async () => {
    const core = EditingCore.create({ extension: Basic.make() })
    const Host = () => {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>
            close
          </button>
          {open ? (
            <EditorProvider core={core}>
              <EditorContent />
            </EditorProvider>
          ) : null}
        </>
      )
    }

    render(<Host />)
    screen.getByRole("button", { name: "close" }).click()

    expect(core.commands.run(BaseCommands.InsertText, "still live")).toBe(true)

    await core.destroy()
  })
})
