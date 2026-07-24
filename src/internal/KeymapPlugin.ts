import { keymap } from "prosemirror-keymap"
import type { Command, Plugin } from "prosemirror-state"

import type { CommandInvocation } from "./CommandInvocation.js"
import type { CommandTag } from "./Command.js"
import type { CommandSurface } from "./editing-core/EditingCore.js"
import { name as chordName } from "./KeyChord.js"
import type { StaticKeymap } from "./Keymap.js"

const runInvocation = (
  commands: CommandSurface<CommandTag.Any>,
  invocation: CommandInvocation,
): boolean => commands.run(invocation.tag, ...invocation.args)

export const create = <Available extends CommandTag.Any>(
  staticKeymap: StaticKeymap,
  commands: CommandSurface<Available>,
): Plugin => {
  const bindings: Record<string, Command> = {}

  for (const binding of staticKeymap.bindings) {
    const name = chordName(binding.chord)
    if (bindings[name]) continue

    const chain = staticKeymap.bindingsFor(binding.chord)
    bindings[name] = () => {
      for (const candidate of chain) {
        if (runInvocation(commands, candidate.invocation)) return true
      }
      return false
    }
  }

  return keymap(bindings)
}
