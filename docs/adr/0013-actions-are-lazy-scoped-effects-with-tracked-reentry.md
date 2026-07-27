# Actions Are Lazy Scoped Effects with Tracked Reentry

Actions represent discrete editing intents that span asynchronous time; they are not asynchronous Commands or a wrapper for arbitrary Effects. `actions.run` returns a lazy Effect, and an Action Execution begins only when that Effect is run. Action Definition requirements are inferred and supplied by the Editing Core, while execution remains explicitly controlled by the caller.

A running Action is linked to both its caller and the owning Editor Scope: interruption from either side ends the Action, Editor Unmount does not, and Editing Core Destroy does. The implementation retains the required Effect Context and hides target registration, mapping, cleanup, and scope linkage behind the Action interface.

The first interface exposes an opaque Tracked Selection and atomic Reentry against the latest state. It reports whether tracked content changed and prevents Reentry after target loss, leaving conflict policy to each Action. It deliberately defers a public synchronous Begin/Execute protocol, generic Target Protocol, execution handles, progress state, and Action-definition merging because those interfaces would impose a large compatibility surface before additional use cases justify them.
