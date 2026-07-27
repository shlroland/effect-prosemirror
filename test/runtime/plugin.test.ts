// @vitest-environment jsdom

import { Plugin, PluginKey } from "prosemirror-state"
import { describe, expect, it } from "vitest"

import {
  EditingCore,
  Editor,
  Extension,
  PluginConfigurationError,
  Priority,
} from "../../src/core.js"
import * as Basic from "../../src/extensions/basic.js"

describe("State Plugin Contribution", () => {
  it("initializes and updates a native State Plugin through Core transactions", async () => {
    const edits = new PluginKey<number>("edits")
    const editCounter = new Plugin({
      key: edits,
      state: {
        init: () => 0,
        apply: (transaction, value) => (transaction.docChanged ? value + 1 : value),
      },
    })
    const core = EditingCore.create({
      extension: Extension.union(Basic.make(), Extension.Plugin(editCounter)),
    })

    expect(edits.getState(core.state)).toBe(0)
    expect(core.transact(({ tr }) => tr.insertText("hello"))).toBe(true)
    expect(edits.getState(core.state)).toBe(1)

    await core.destroy()
  })

  it("installs higher-priority State Plugins first", async () => {
    const initialized: string[] = []
    const low = Extension.Plugin(
      new Plugin({
        state: {
          init: () => {
            initialized.push("low")
            return undefined
          },
          apply: (_, value) => value,
        },
      }),
    ).pipe(Extension.priority(Priority.Low))
    const high = Extension.Plugin(
      new Plugin({
        state: {
          init: () => {
            initialized.push("high")
            return undefined
          },
          apply: (_, value) => value,
        },
      }),
    ).pipe(Extension.priority(Priority.High))
    const core = EditingCore.create({ extension: Extension.union(Basic.make(), low, high) })

    expect(initialized).toEqual(["high", "low"])

    await core.destroy()
  })

  it("lets a State Plugin reject a Core transaction", async () => {
    const core = EditingCore.create({
      extension: Extension.union(
        Basic.make(),
        Extension.Plugin(
          new Plugin({
            filterTransaction: (transaction) => !transaction.docChanged,
          }),
        ),
      ),
    })

    expect(core.transact(({ tr }) => tr.insertText("blocked"))).toBe(false)
    expect(core.state.doc.textContent).toBe("")

    await core.destroy()
  })

  it("applies a State Plugin appended transaction through the Core", async () => {
    const appended = "test/appended"
    const core = EditingCore.create({
      extension: Extension.union(
        Basic.make(),
        Extension.Plugin(
          new Plugin({
            appendTransaction: (transactions, _, state) =>
              transactions.some(
                (transaction) => transaction.docChanged && transaction.getMeta(appended) !== true,
              )
                ? state.tr.insertText("!", state.selection.to).setMeta(appended, true)
                : undefined,
          }),
        ),
      ),
    })

    expect(core.transact(({ tr }) => tr.insertText("hello"))).toBe(true)
    expect(core.state.doc.textContent).toBe("hello!")

    await core.destroy()
  })

  it("recreates its Plugin View when a live Core is remounted", async () => {
    const lifecycle: string[] = []
    const core = EditingCore.create({
      extension: Extension.union(
        Basic.make(),
        Extension.Plugin(
          new Plugin({
            view: () => {
              lifecycle.push("mount")
              return {
                update: () => lifecycle.push("update"),
                destroy: () => lifecycle.push("destroy"),
              }
            },
          }),
        ),
      ),
    })
    const first = Editor.mount(core, document.body.appendChild(document.createElement("div")))

    expect(lifecycle).toEqual(["mount"])
    first.transact(({ tr }) => tr.insertText("hello"))
    expect(lifecycle).toEqual(["mount", "update"])

    first.unmount()
    expect(lifecycle).toEqual(["mount", "update", "destroy"])

    const second = Editor.mount(core, document.body.appendChild(document.createElement("div")))
    expect(lifecycle).toEqual(["mount", "update", "destroy", "mount"])

    await second.destroy()
    expect(lifecycle).toEqual(["mount", "update", "destroy", "mount", "destroy"])
  })

  it("normalizes duplicate keyed Plugin configuration failures", () => {
    const key = new PluginKey("duplicate")
    const extension = Extension.union(
      Basic.make(),
      Extension.Plugin(new Plugin({ key })),
      Extension.Plugin(new Plugin({ key })),
    )

    expect(() => EditingCore.create({ extension })).toThrow(PluginConfigurationError)
  })
})
