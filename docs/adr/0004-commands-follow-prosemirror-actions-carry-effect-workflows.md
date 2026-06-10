# Commands follow ProseMirror; Actions carry Effect workflows

Commands keep ProseMirror's existing synchronous command contract and do not receive Effect services or editor-specific runtime context. Service-dependent, asynchronous, or custom Effect-managed workflows belong to Actions, which are a library-defined concept designed to reenter ProseMirror through synchronous editing operations.
