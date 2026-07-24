import { Effect } from "effect"

import { InvalidKeyError } from "./Error.js"

export interface CharacterKey {
  readonly _tag: "Character"
  readonly value: string
}

export type DigitValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export interface DigitKey {
  readonly _tag: "Digit"
  readonly value: DigitValue
}

export type FunctionKeyValue =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24

export interface FunctionKey {
  readonly _tag: "Function"
  readonly value: FunctionKeyValue
}

export type NamedKeyValue =
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "Backspace"
  | "Delete"
  | "End"
  | "Enter"
  | "Escape"
  | "Home"
  | "Insert"
  | "PageDown"
  | "PageUp"
  | "Space"
  | "Tab"

export interface NamedKey {
  readonly _tag: "Named"
  readonly value: NamedKeyValue
}

export type Key = CharacterKey | DigitKey | FunctionKey | NamedKey

const named = (value: NamedKeyValue): NamedKey => Object.freeze({ _tag: "Named", value })

const character = (value: string): CharacterKey => {
  if (Array.from(value).length !== 1 || /[\p{C}\p{Z}]/u.test(value)) {
    throw new InvalidKeyError({ value, reason: "NotSinglePrintableCharacter" })
  }
  return Object.freeze({ _tag: "Character", value })
}

export const Character = (value: string): CharacterKey => character(value)

export const decodeCharacter = (value: string): Effect.Effect<CharacterKey, InvalidKeyError> =>
  Effect.try({
    try: () => character(value),
    catch: (error) =>
      error instanceof InvalidKeyError
        ? error
        : new InvalidKeyError({ value, reason: "NotSinglePrintableCharacter" }),
  })

export const Digit = (value: DigitValue): DigitKey => Object.freeze({ _tag: "Digit", value })

export const Function = (value: FunctionKeyValue): FunctionKey => {
  if (!Number.isInteger(value) || value < 1 || value > 24) {
    throw new InvalidKeyError({ value, reason: "InvalidFunctionKey" })
  }
  return Object.freeze({ _tag: "Function", value })
}

export const ArrowDown = named("ArrowDown")
export const ArrowLeft = named("ArrowLeft")
export const ArrowRight = named("ArrowRight")
export const ArrowUp = named("ArrowUp")
export const Backspace = named("Backspace")
export const Delete = named("Delete")
export const End = named("End")
export const Enter = named("Enter")
export const Escape = named("Escape")
export const Home = named("Home")
export const Insert = named("Insert")
export const PageDown = named("PageDown")
export const PageUp = named("PageUp")
export const Space = named("Space")
export const Tab = named("Tab")

export const name = (key: Key): string => {
  switch (key._tag) {
    case "Character":
      return key.value
    case "Digit":
      return String(key.value)
    case "Function":
      return `F${key.value}`
    case "Named":
      return key.value
  }
}
