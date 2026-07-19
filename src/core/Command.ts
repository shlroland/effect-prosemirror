import type { Command as ProseMirrorCommand, EditorState } from "prosemirror-state"

const CommandTagTypeId = Symbol("effect-prosemirror/CommandTag")
const CommandDefinitionTypeId = Symbol("effect-prosemirror/CommandDefinition")

type MutableTuple<Args extends readonly unknown[]> = Args extends readonly [...infer Values]
  ? Values
  : never

export interface CommandTag<Self, Name extends string, Args extends readonly unknown[]> {
  readonly _tag: "CommandTag"
  readonly commandName: Name
  readonly [CommandTagTypeId]: {
    readonly _Self: (_: Self) => Self
    readonly _Args: Args
  }
}

export namespace CommandTag {
  export type Any = CommandTag<any, string, readonly unknown[]>
  export type Name<Tag extends Any> = Tag extends CommandTag<any, infer Name, any> ? Name : never
  export type Args<Tag extends Any> =
    Tag extends CommandTag<any, any, infer Args> ? MutableTuple<Args> : never
}

export interface CommandTagClass<
  Self,
  Name extends string,
  Args extends readonly unknown[],
> extends CommandTag<Self, Name, Args> {
  new (_: never): CommandTagClassShape<Name, Args>
}

export interface CommandTagClassShape<Name extends string, Args extends readonly unknown[]> {
  readonly [CommandTagTypeId]: typeof CommandTagTypeId
  readonly Name: Name
  readonly Args: Args
}

export const Tag =
  <const Name extends string>(commandName: Name) =>
  <Self, Args extends readonly unknown[]>(): CommandTagClass<Self, Name, Args> => {
    function TagClass() {}

    Object.defineProperties(TagClass, {
      _tag: { value: "CommandTag", enumerable: true },
      commandName: { value: commandName, enumerable: true },
      [CommandTagTypeId]: { value: undefined },
    })

    return TagClass as unknown as CommandTagClass<Self, Name, Args>
  }

export type CommandCreator<Args extends readonly unknown[] = readonly unknown[]> = (
  ...args: MutableTuple<Args>
) => ProseMirrorCommand

export type IsActive<Args extends readonly unknown[] = readonly unknown[]> = (
  ...args: MutableTuple<Args>
) => (state: EditorState) => boolean

export interface CommandDefinition<Tag extends CommandTag.Any = CommandTag.Any> {
  readonly _tag: "CommandDefinition"
  readonly [CommandDefinitionTypeId]: typeof CommandDefinitionTypeId
  readonly tag: Tag
  readonly run: CommandCreator<CommandTag.Args<Tag>>
  readonly isActive?: IsActive<CommandTag.Args<Tag>>
}

export const define = <const Tag extends CommandTag.Any>(
  tag: Tag,
  options: {
    readonly run: CommandCreator<CommandTag.Args<Tag>>
    readonly isActive?: IsActive<CommandTag.Args<Tag>>
  },
): CommandDefinition<Tag> => ({
  _tag: "CommandDefinition",
  [CommandDefinitionTypeId]: CommandDefinitionTypeId,
  tag,
  run: options.run,
  ...(options.isActive ? { isActive: options.isActive } : {}),
})
