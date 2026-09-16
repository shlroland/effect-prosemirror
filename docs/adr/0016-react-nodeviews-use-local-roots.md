# React NodeViews Use Local Roots

Status: Accepted.

Each React-backed NodeView creates one React root in its native ProseMirror
`create` lifecycle and synchronously unmounts that root in `destroy`. The React
root manages only a dedicated `reactDOM` element. ProseMirror retains ownership
of the outer NodeView DOM and, for non-leaf nodes, a sibling `contentDOM` that
is outside React reconciliation.

This aligns React root lifetime exactly with ProseMirror NodeView construction,
update, replacement, and destruction. A root that was unmounted cannot be
rendered again, which is compatible with ProseMirror replacing a NodeView by
constructing a new instance.

A shared React root with portals was rejected for the first adapter. ProseMirror
may synchronously remove a NodeView DOM target before React has updated its
portal tree, introducing separate target-liveness and teardown ordering rules.
That extra coordination would make the adapter responsible for DOM ownership
that ProseMirror already defines. A later adapter may revisit portals only with
a concrete need that outweighs this lifecycle cost.
