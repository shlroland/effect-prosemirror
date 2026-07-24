export const Highest = "highest" as const
export const High = "high" as const
export const Default = "default" as const
export const Low = "low" as const
export const Lowest = "lowest" as const

export const Priority = {
  Highest,
  High,
  Default,
  Low,
  Lowest,
} as const

export type Priority = (typeof Priority)[keyof typeof Priority]
