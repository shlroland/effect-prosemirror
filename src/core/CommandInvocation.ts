import type { CommandTag } from "./Command.js"

export interface CommandInvocation<Tag extends CommandTag.Any = CommandTag.Any> {
  readonly _tag: "CommandInvocation"
  readonly tag: Tag
  readonly args: Readonly<CommandTag.Args<Tag>>
}

export const make = <const Tag extends CommandTag.Any>(
  tag: Tag,
  ...args: CommandTag.Args<Tag>
): CommandInvocation<Tag> =>
  Object.freeze({
    _tag: "CommandInvocation",
    tag,
    args: Object.freeze([...args]) as unknown as Readonly<CommandTag.Args<Tag>>,
  })
