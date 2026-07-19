# Editor scope per editor instance

Each Editing Core owns its own Editor Scope instead of sharing a single global Effect runtime. A mounted Editor Instance inherits that scope. Application services can still be provided from outside, but editor-local resources, subscriptions, and background work live inside the per-core scope. Calling `destroy()` synchronously invalidates the core and unmounts its View, then returns a shared `Promise<void>` that completes after all potentially asynchronous finalizers finish. Destroy is idempotent and cannot be reversed by mounting again.
