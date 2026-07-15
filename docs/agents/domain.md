# Domain Docs

How engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- Root `CONTEXT.md`
- ADRs in `docs/adr/` that touch the area being changed

If any of these files do not exist, proceed without flagging their absence.

## File structure

This is a single-context repository:

```txt
/
|- CONTEXT.md
|- docs/adr/
`- src/
```

## Use the glossary's vocabulary

Use the terms defined in `CONTEXT.md` in issue titles, designs, tests, and reviews. If a needed concept is absent from the glossary, reconsider whether it is new language or a genuine gap to address through domain modeling.

## Flag ADR conflicts

Surface conflicts with an existing ADR instead of silently overriding its decision.
