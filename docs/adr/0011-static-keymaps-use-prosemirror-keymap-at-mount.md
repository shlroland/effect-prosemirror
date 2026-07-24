# Static Keymaps Use prosemirror-keymap at mount

Static Keymaps remain DOM-independent Extension contributions collected and Final Validated by the Editing Core. `Editor.mount` compiles each ordered same-chord chain into one ProseMirror command and supplies those commands to `prosemirror-keymap` as an EditorView direct plugin.

The adapter does not parse browser events, resolve `Mod`, normalize key names, or implement shifted-character fallback. `prosemirror-keymap` owns those established ProseMirror behaviors. The compiled chain calls each captured Command Invocation through the mounted Command Surface in priority order; a `false` result advances to the next binding, while the first `true` consumes the key.

The plugin is View-owned rather than an Editing Core `EditorState` plugin. It therefore has no state field, transaction filter, or append behavior, and is removed automatically when the View is unmounted or destroyed. Every handled command still returns through the Core-owned transaction path.
