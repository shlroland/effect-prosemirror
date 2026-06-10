export const Highest = "highest"
export const High = "high"
export const Default = "default"
export const Low = "low"
export const Lowest = "lowest"

export const Priority = {
  Highest,
  High,
  Default,
  Low,
  Lowest,
} as const

export type Priority = (typeof Priority)[keyof typeof Priority]
