import type { Key } from "./Key.js"
import { name as keyName } from "./Key.js"

export const Modifier = {
  Mod: "Mod",
  Ctrl: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Meta: "Meta",
} as const

export type Modifier = (typeof Modifier)[keyof typeof Modifier]

const modifierOrder: readonly Modifier[] = [
  Modifier.Mod,
  Modifier.Ctrl,
  Modifier.Alt,
  Modifier.Shift,
  Modifier.Meta,
]

export interface KeyChord {
  readonly _tag: "KeyChord"
  readonly modifiers: readonly Modifier[]
  readonly key: Key
}

export const make = (options: {
  readonly modifiers?: readonly Modifier[]
  readonly key: Key
}): KeyChord => {
  const included = new Set(options.modifiers ?? [])
  const modifiers = Object.freeze(modifierOrder.filter((modifier) => included.has(modifier)))
  return Object.freeze({ _tag: "KeyChord", modifiers, key: options.key })
}

export const identity = (chord: KeyChord): string =>
  JSON.stringify([chord.modifiers, keyName(chord.key)])

export const name = (chord: KeyChord): string => [...chord.modifiers, keyName(chord.key)].join("-")
