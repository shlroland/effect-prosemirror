import type { Node as ProseMirrorNode } from "prosemirror-model"

export interface MarkJSON {
  readonly type: string
  readonly attrs?: Readonly<Record<string, unknown>> | null
}

export interface NodeJSON {
  readonly type: string
  readonly attrs?: Readonly<Record<string, unknown>> | null
  readonly content?: readonly NodeJSON[]
  readonly marks?: readonly MarkJSON[]
  readonly text?: string
}

export interface NodeInitialContent {
  readonly _tag: "Node"
  readonly node: ProseMirrorNode
}

export interface JSONInitialContent {
  readonly _tag: "JSON"
  readonly json: NodeJSON
}

export interface HTMLInitialContent {
  readonly _tag: "HTML"
  readonly html: string
}

export type InitialContent = NodeInitialContent | JSONInitialContent | HTMLInitialContent

export const Node = (node: ProseMirrorNode): NodeInitialContent => ({ _tag: "Node", node })

const fromNode = (node: ProseMirrorNode): JSONInitialContent => ({
  _tag: "JSON",
  json: node.toJSON() as NodeJSON,
})

export const JSON = Object.assign(
  (json: NodeJSON): JSONInitialContent => ({ _tag: "JSON", json }),
  { fromNode },
)

export const HTML = (html: string): HTMLInitialContent => ({ _tag: "HTML", html })
