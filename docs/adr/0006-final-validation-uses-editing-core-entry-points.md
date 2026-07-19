# ADR 0006: Final Validation Uses Editing Core Entry Points

## Status

Accepted.

## Context

An Extension Union may intentionally retain Forward References. A `NodeAttr` or `MarkAttr` can target a spec supplied by another extension, so the individual contribution cannot be rejected when it is created or composed.

The first type-level Final Validation check must report missing node and mark targets without collapsing valid extension values to `never` or preventing partial extensions from being authored.

## Decision

`EditingCore.create`, `EditingCore.make`, and `EditingCore.layer` are the first typed Final Validation entry points. They require an extension whose raw contribution spec has no unresolved schema targets, Command Tags, or other completeness requirements. The mounted `createEditor` convenience constructor inherits this validation by creating an Editing Core before mounting it.

`EditingCore.FinalValidation<Extension>` resolves to `unknown` for a valid extension. For an invalid extension it resolves to an object whose `extension` property is a `Diagnostic` carrying one or more typed issues such as `MissingNodeTarget`, `MissingMarkTarget`, or `MissingCommandImplementation`. Each diagnostic includes the identifying details needed to locate the unresolved contribution.

The validation type traverses nested `Extension.union` values, collecting raw node and mark spec names plus node and mark attr targets before comparing them. This preserves Forward References.

## Consequences

- Partial extensions remain composable and pipeable.
- Editing Core construction reports readable type errors at the public boundary.
- Runtime `EditorSchema.create` retains its corresponding tagged errors.
- Keymap, schema completeness, and service diagnostics are added as the corresponding contribution models enter the executable Editing Core.
- A Static Keymap may reference a Command Tag without providing its implementation locally; only an unresolved Tag at an Editing Core entry point is invalid.
- Complete-core runtime validation reports all discovered diagnostics in one `FinalValidationError` rather than stopping at the first issue.
