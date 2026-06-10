# Synchronous commands with Effectful Actions

Commands remain synchronous ProseMirror editing operations because ProseMirror state, selection, plugin, and transaction protocols assume immediate decisions. Asynchronous work is modeled as Effectful Actions that can later use Reentry to submit a synchronous editing operation against the current editor state.
