import {
  DOMParser as ProseMirrorDOMParser,
  Node as ProseMirrorNode,
  type Schema,
} from "prosemirror-model"

import {
  InitialContentCreationError,
  InitialContentDocumentUnavailableError,
  InvalidInitialContentError,
} from "../Error.js"
import type { InitialContent } from "../InitialContent.js"

const invalidContent = (
  source: "Node" | "JSON" | "HTML",
  cause: unknown,
): InvalidInitialContentError =>
  new InvalidInitialContentError({ source, reason: "InvalidDocument", cause })

const validateDocument = (
  schema: Schema,
  node: ProseMirrorNode,
  source: "Node" | "JSON" | "HTML",
): ProseMirrorNode => {
  if (node.type.schema !== schema) {
    throw new InvalidInitialContentError({ source, reason: "SchemaMismatch" })
  }

  try {
    if (node.type !== schema.topNodeType) {
      throw new RangeError(`Expected top node ${schema.topNodeType.name}, got ${node.type.name}`)
    }
    node.check()
    return node
  } catch (cause) {
    if (cause instanceof InvalidInitialContentError) throw cause
    throw invalidContent(source, cause)
  }
}

export const create = (schema: Schema, initialContent?: InitialContent): ProseMirrorNode => {
  if (!initialContent) {
    const node = schema.topNodeType.createAndFill()
    if (!node) {
      throw new InitialContentCreationError({ reason: "TopNodeCannotCreateAndFill" })
    }
    return node
  }

  switch (initialContent._tag) {
    case "Node":
      return validateDocument(schema, initialContent.node, "Node")
    case "JSON":
      try {
        return validateDocument(
          schema,
          ProseMirrorNode.fromJSON(schema, initialContent.json),
          "JSON",
        )
      } catch (cause) {
        if (cause instanceof InvalidInitialContentError) throw cause
        throw invalidContent("JSON", cause)
      }
    case "HTML": {
      if (typeof document === "undefined") {
        throw new InitialContentDocumentUnavailableError()
      }

      try {
        const container = document.createElement("div")
        container.innerHTML = initialContent.html
        const node = ProseMirrorDOMParser.fromSchema(schema).parse(container)
        return validateDocument(schema, node, "HTML")
      } catch (cause) {
        if (cause instanceof InvalidInitialContentError) throw cause
        throw invalidContent("HTML", cause)
      }
    }
  }
}
