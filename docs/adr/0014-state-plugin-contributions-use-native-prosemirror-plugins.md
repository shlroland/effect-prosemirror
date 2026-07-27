# State Plugin Contributions Use Native ProseMirror Plugins

The first Plugin contribution is `Extension.Plugin(plugin)`, where `plugin` is
a normal `prosemirror-state` `Plugin`. It does not wrap PluginSpec, define a
second plugin lifecycle, or expose a Core-level Plugin Surface.

The Editing Core compiles plugins by descending Extension priority followed by
declaration order and passes them to `EditorState.create`. Consequently state
fields, transaction filters, and appended transactions run through the same
Core-owned state path as Commands, Actions, and DOM transactions. A mounted
EditorView owns native Plugin View initialization, updates, and destruction.

Plugin state remains accessible through the standard ProseMirror `PluginKey`
against the Core or Editor state. Invalid plugin configuration is normalized at
Core construction rather than exposing raw ProseMirror failures.

Effect-backed plugins are deferred. Their requirements, fibers, finalizers, and
asynchronous failures require a separate scoped lifecycle; combining that with
the static contribution would broaden the first interface without providing
enough leverage.
