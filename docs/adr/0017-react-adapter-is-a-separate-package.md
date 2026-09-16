# React Adapter Is a Separate Package

Status: Accepted.

The CSR React adapter will be published as `@effect-prosemirror/react`, separate from the framework's core package. This keeps the Core free of React and UI dependencies while allowing the adapter's peer dependencies and release cadence to evolve independently. Applications compose the adapter with a caller-owned Core; the adapter neither creates nor destroys the Core or its Effect Scope.
