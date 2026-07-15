import type { Command as ProseMirrorCommand, EditorState } from "prosemirror-state"

const CommandDefinitionTypeId = Symbol("effect-prosemirror/CommandDefinition")

export type CommandCreator<Args extends readonly any[] = readonly any[]> = (
  ...args: Args
) => ProseMirrorCommand

export type IsActive<Args extends readonly any[] = readonly any[]> = (
  ...args: Args
) => (state: EditorState) => boolean

export interface CommandDefinition<
  Run extends CommandCreator = CommandCreator,
  Active extends IsActive<Parameters<Run>> | undefined = IsActive<Parameters<Run>> | undefined,
> {
  readonly _tag: "CommandDefinition"
  readonly [CommandDefinitionTypeId]: typeof CommandDefinitionTypeId
  readonly run: Run
  readonly isActive?: Active
}

type IsActiveCreator = (...args: readonly any[]) => (state: EditorState) => boolean

type IsEqual<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false

type MatchingIsActive<Run extends CommandCreator, Active extends IsActiveCreator> =
  IsEqual<Parameters<Run>, Parameters<Active>> extends true ? Active : never

export function define<const Run extends CommandCreator>(options: {
  readonly run: Run
}): CommandDefinition<Run>

export function define<
  const Run extends CommandCreator,
  const Active extends IsActiveCreator,
>(options: {
  readonly run: Run
  readonly isActive: Active & MatchingIsActive<Run, Active>
}): CommandDefinition<Run, Active>

export function define(options: {
  readonly run: CommandCreator
  readonly isActive?: IsActiveCreator
}): CommandDefinition<CommandCreator, IsActiveCreator | undefined> {
  return {
    _tag: "CommandDefinition",
    [CommandDefinitionTypeId]: CommandDefinitionTypeId,
    run: options.run,
    ...(options.isActive ? { isActive: options.isActive } : {}),
  }
}
