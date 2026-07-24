# Extension Service Requirements Propagate to Construction

`Extension.Require(ServiceTag)` is an explicit, non-providing contribution. Extension Union accumulates its required Effect service identifiers as a union, while runtime collection de-duplicates equal tag keys.

`EditingCore.make` requires the accumulated services in its Effect environment in addition to its Scope. `EditingCore.layer` exposes the same union as its input requirement. Both construction paths inspect the supplied Context and fail with `MissingServiceError { services }` before creating the Editing Core when a declared service is absent.

Synchronous `EditingCore.create` and `createEditor` accept a no-input Layer that provides the accumulated requirements. The Layer is built in the Core's Editor Scope, so any acquired resource survives until `destroy()` closes that scope. These constructors cannot await async Layer acquisition; Layer construction failures are wrapped as `ServiceLayerCreationError { cause }`. Applications that need asynchronous or externally dependent Layer construction use the Effect-native APIs.

Extensions do not embed arbitrary business Layers. Service provisioning remains an application decision, and future Actions or Effect-backed Plugins will infer their requirements automatically while preserving `Extension.Require` for explicit external contracts.
