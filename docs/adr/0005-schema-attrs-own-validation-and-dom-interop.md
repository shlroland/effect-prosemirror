# ADR 0005: Schema Attrs Own Validation and DOM Interop

## Status

Accepted.

## Context

`NodeAttr` and `MarkAttr` augment schema elements declared elsewhere in an Extension Union. An attribute needs to contribute its ProseMirror `AttributeSpec`, may need synchronous validation, and may need to participate in the target node or mark's DOM parsing and serialization without replacing the entire target spec.

These contributions also participate in schema priority. Definitions for the same target and attribute can come from either a `NodeSpec` / `MarkSpec` `attrs` field or a standalone attr contribution.

## Decision

Attribute contributions accept either a low-level ProseMirror `AttributeSpec` or high-level `default`, ProseMirror `validate`, and context-free Effect Schema options. Effect Schema validation is compiled to ProseMirror's synchronous `AttributeSpec.validate` hook.

An attribute may also define:

- `parseDOM(element)`, which reads the attribute value from an `HTMLElement`
- `toDOM(value)`, which returns a DOM attribute name/value pair or `null`

Final schema collection merges definitions for the same target and attribute before wrapping the target spec. Higher-priority fields override lower-priority fields, including definitions originating in a node or mark spec's `attrs` field. Distinct attributes compose in stable contribution order.

Attribute parsing wraps tag parse rules while preserving static `attrs`, existing `getAttrs`, and `false` rejection. Style parse rules are unchanged because their parser input is a CSS value. Attribute serialization merges the returned pair into the top-level DOM attributes produced by the existing target `toDOM` function.

## Consequences

- Forward References remain valid until Final Validation.
- Attribute validation stays synchronous and compatible with ProseMirror.
- Node and mark specs remain the source of the rendered element shape.
- Attr contributions cannot add DOM parsing or serialization when the target spec has no corresponding `parseDOM` rule or `toDOM` function.
