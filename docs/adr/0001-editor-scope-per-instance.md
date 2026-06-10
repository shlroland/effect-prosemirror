# Editor scope per editor instance

Each editor instance owns its own Editor Scope instead of sharing a single global Effect runtime. Application services can still be provided from outside, but editor-local resources, subscriptions, and background work live inside the per-editor scope so destroying the editor interrupts and releases them predictably.
