# ADR 0006: Final Validation Uses Editor Entry Points

## Status

Accepted.

## Context

An Extension Union may intentionally contain Forward References. A `NodeAttr` or `MarkAttr` can target a spec supplied by another extension, so the individual contribution cannot be rejected when it is created or composed.

The first type-level Final Validation check must report missing node and mark targets without collapsing valid extension values to `never` or preventing partial extensions from being authored.

## Decision

`Editor.layer`, `Editor.make`, and `createEditor` are the first typed Final Validation entry points. They require an extension whose raw contribution spec has no missing node or mark attr targets.

`Editor.FinalValidation<Extension>` resolves to `unknown` for a valid extension. For an invalid extension it resolves to an object whose `extension` property is a `Diagnostic` carrying one or more `MissingNodeTarget` or `MissingMarkTarget` values. Each diagnostic includes the target type and attribute name.

The validation type traverses nested `Extension.union` values, collecting raw node and mark spec names plus node and mark attr targets before comparing them. This preserves Forward References.

## Consequences

- Partial extensions remain composable and pipeable.
- Editor construction reports readable type errors at the public boundary.
- Runtime `EditorSchema.create` retains its corresponding tagged errors.
- Keymap, schema completeness, and service diagnostics remain future Final Validation slices.
