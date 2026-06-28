# Repository Guidelines

## Project Structure & Module Organization

This is a private TypeScript package for an Effect-managed ProseMirror runtime. Public source lives in `src/`, with the current core API under `src/core/` and the package entry point at `src/index.ts`. Runtime tests are in `test/runtime/**/*.test.ts`; compile-time type tests are in `test/type/**/*.test-d.ts`. Design context belongs in `CONTEXT.md`, `docs/design.md`, `docs/implementation-plan.md`, and ADRs under `docs/adr/`. Generated build output goes to `dist/` and should not be edited by hand.

## Build, Test, and Development Commands

Use mise for project-level Node and pnpm management. The package manager should match `packageManager: pnpm@11.9.0`.

- `pnpm build`: emits JavaScript, declarations, declaration maps, and source maps using `tsconfig.build.json`.
- `pnpm test`: runs Vitest runtime tests and configured type tests.
- `pnpm typecheck`: runs strict TypeScript checking without emitting files.

Before handing off changes, run at least `pnpm typecheck` and `pnpm test`; run `pnpm build` when exports or emitted package shape changes.

## Coding Style & Naming Conventions

Use strict ESM TypeScript with `NodeNext` resolution. Include `.js` extensions in relative imports, as existing files do (`./Priority.js`). Prefer immutable shapes (`readonly` properties, readonly arrays) and explicit exported interfaces/types for public API. Follow the existing formatting style: two-space indentation, double quotes, no semicolons, trailing commas in multiline constructs. Name source files after exported concepts, for example `Extension.ts`, `Command.ts`, and `Priority.ts`.

## Testing Guidelines

Use Vitest for runtime behavior and `expect-type`/Vitest typecheck for type-level contracts. Place behavior tests in `test/runtime/<feature>.test.ts` and type assertions in `test/type/<feature>.test-d.ts`. Add focused tests for contribution merging, command behavior, editor lifecycle, and type diagnostics when changing those surfaces. Keep tests small and named by observable behavior, such as `it("does not mutate the original extension when priority is applied", ...)`.

## Commit & Pull Request Guidelines

The current history uses Conventional Commit prefixes, for example `feat: add pipeable extension core`, `chore: scaffold package`, and `docs: capture initial design`. Keep commits scoped and descriptive. PRs should explain the API or behavior change, list validation commands run, and link any relevant issue, design doc, or ADR. Include screenshots only for documentation rendering changes where visual output matters.

## Architecture & Terminology

Preserve the domain language in `CONTEXT.md`: Commands are synchronous ProseMirror operations, while Effectful Actions handle asynchronous or Effect-managed workflows and reenter the editor later. Update `CONTEXT.md` or add an ADR when introducing new architectural terms, merge rules, lifecycle boundaries, or public API decisions.
