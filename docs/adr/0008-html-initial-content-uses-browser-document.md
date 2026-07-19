# HTML Initial Content Uses Browser Document

Initial Content is an optional readonly `_tag` discriminated union with `Node`, `JSON`, and `HTML` variants. When omitted, the Editing Core uses `schema.topNodeType.createAndFill()` to create the initial document. HTML parsing uses the browser's global `document`; when it is unavailable, Editing Core creation fails rather than the library injecting or selecting a server-side DOM implementation. This preserves a DOM-independent Editing Core while leaving server-side DOM choice to an explicit future adapter.

The failure boundary is explicit. HTML without a global browser `document` fails with `InitialContentDocumentUnavailableError`. Explicit Node, JSON, or HTML content that cannot create a document for the composed schema fails with `InvalidInitialContentError`, carrying `source: "Node" | "JSON" | "HTML"` and a retained `cause`. Omitted content whose `topNodeType.createAndFill()` returns null fails with `InitialContentCreationError { reason: "TopNodeCannotCreateAndFill" }`.

Direct `InitialContent.Node(node)` preserves Schema identity and requires `node.type.schema === core.schema`; a foreign Node fails with `InvalidInitialContentError { source: "Node", reason: "SchemaMismatch" }`. `InitialContent.JSON.fromNode(node)` is the explicit cross-schema bridge: it snapshots `node.toJSON()` and reconstructs the document through the composed target Schema.

The library does not add a second generic Effect Schema decoder for NodeJSON. Applications can pre-decode unknown input with their own Effect Schema and then pass `InitialContent.JSON`; ProseMirror `Node.fromJSON` remains authoritative for target-schema document validity.
