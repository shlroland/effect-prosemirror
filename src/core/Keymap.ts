import type { CommandInvocation } from "./CommandInvocation.js"
import type { Contribution, Extension } from "./Extension.js"
import type { KeyChord } from "./KeyChord.js"
import { identity as chordIdentity } from "./KeyChord.js"
import { Priority, type Priority as PriorityValue } from "./Priority.js"

export interface KeyBinding<Invocation extends CommandInvocation = CommandInvocation> {
  readonly _tag: "KeyBinding"
  readonly chord: KeyChord
  readonly invocation: Invocation
}

export const bind = <const Invocation extends CommandInvocation>(
  chord: KeyChord,
  invocation: Invocation,
): KeyBinding<Invocation> => Object.freeze({ _tag: "KeyBinding", chord, invocation })

export interface StaticKeymap {
  readonly _tag: "StaticKeymap"
  readonly bindings: readonly KeyBinding[]
  readonly bindingsFor: (chord: KeyChord) => readonly KeyBinding[]
}

interface IndexedBinding {
  readonly binding: KeyBinding
  readonly priority: PriorityValue
  readonly index: number
}

const priorityRank: Record<PriorityValue, number> = {
  [Priority.Lowest]: 0,
  [Priority.Low]: 1,
  [Priority.Default]: 2,
  [Priority.High]: 3,
  [Priority.Highest]: 4,
}

const isKeymapContribution = (
  contribution: Contribution,
): contribution is Contribution<"keymap.bindings", readonly KeyBinding[]> =>
  contribution.type === "keymap.bindings"

export const collect = (extension: Extension.Any): StaticKeymap => {
  const indexed: IndexedBinding[] = []
  let index = 0

  for (const contribution of extension.contributions) {
    if (!isKeymapContribution(contribution)) continue
    for (const binding of contribution.payload) {
      indexed.push({ binding, priority: contribution.priority, index })
      index += 1
    }
  }

  indexed.sort((left, right) => {
    const difference = priorityRank[right.priority] - priorityRank[left.priority]
    return difference === 0 ? left.index - right.index : difference
  })

  const bindings = Object.freeze(indexed.map(({ binding }) => binding))
  const chains = new Map<string, readonly KeyBinding[]>()

  for (const binding of bindings) {
    const key = chordIdentity(binding.chord)
    const chain = chains.get(key)
    chains.set(key, chain ? Object.freeze([...chain, binding]) : Object.freeze([binding]))
  }

  return Object.freeze({
    _tag: "StaticKeymap",
    bindings,
    bindingsFor: (chord: KeyChord) => chains.get(chordIdentity(chord)) ?? [],
  })
}
