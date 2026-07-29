import { TextSelection } from "prosemirror-state"

import { EditingCore, type Extension as ExtensionModule } from "../../src/core.js"

const selection = (
  content: string,
): { readonly text: string; readonly from: number; readonly to: number } => {
  const anchor = content.indexOf("<a>")
  const head = content.indexOf("<b>")
  if (anchor === -1) throw new TypeError("Test content must include an <a> selection anchor")

  const text = content.replaceAll("<a>", "").replaceAll("<b>", "")
  const beforeAnchor = content.slice(0, anchor).replaceAll("<a>", "").replaceAll("<b>", "")
  const beforeHead =
    head === -1 ? beforeAnchor : content.slice(0, head).replaceAll("<a>", "").replaceAll("<b>", "")

  return {
    text,
    from: beforeAnchor.length + 1,
    to: beforeHead.length + 1,
  }
}

export interface TestCore {
  readonly core: EditingCore.Any
  readonly set: (content: string) => void
}

export const createTestCore = <ExtensionValue extends ExtensionModule.Extension.Any>(options: {
  readonly extension: ExtensionValue
}): TestCore => {
  const core = (EditingCore.create as (options: EditingCore.Options) => EditingCore.Any)({
    extension: options.extension,
  })

  return {
    core,
    set: (content) => {
      const target = selection(content)
      core.transact(({ state, tr }) => {
        const paragraph = state.schema.nodes.paragraph
        if (!paragraph) throw new TypeError("Test content requires a paragraph node")

        const node = paragraph.create(
          null,
          target.text ? state.schema.text(target.text) : undefined,
        )
        return tr
          .replaceWith(0, state.doc.content.size, node)
          .setSelection(TextSelection.create(tr.doc, target.from, target.to))
      })
    },
  }
}
