# NodeView Adapters Are View-Owned

Status: Accepted.

`Extension.NodeView({ node, create })` declares a native ProseMirror NodeView
adapter for one schema node name. Its contribution remains static and can be
collected while creating an Editing Core, but its factory is never called
there: NodeViews require DOM and an `EditorView`.

The Editing Core Final Validation verifies that each adapter's target node
exists in the complete Extension Union. The compiled registry keeps one
adapter per node name. Higher Extension priority wins; at equal priority a
later declaration wins. This is an override merge, rather than the fallback
merge used by Commands and Keymaps, because `EditorView` accepts only one
NodeView constructor per node name.

`Editor.mount` converts the registry into the native `nodeViews` direct prop
when constructing `EditorView`. ProseMirror then owns individual NodeView
construction, `update`, replacement when `update` returns `false`, and
`destroy`. Existing mounted state synchronization remains unchanged: a
NodeView that calls `view.dispatch` reaches the Core's normal
`dispatchTransaction` path. Destroying or unmounting the Editor View destroys
NodeViews, while the Core remains DOM-independent and may later be remounted.

The first adapter is deliberately synchronous and framework-neutral. It does
not create an Effect Scope per NodeView and it does not provide a second DOM
or transaction abstraction. Framework packages may consume the exported
NodeView Context to mount and unmount their renderers inside the native
NodeView lifecycle. Per-NodeView asynchronous resources require a future,
separately designed View Scope; Action Executions continue to belong to the
Editor Scope and survive View unmount.
