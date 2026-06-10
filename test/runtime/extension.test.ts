import { describe, expect, it } from "vitest"

import * as Extension from "../../src/core/Extension.js"
import { Priority } from "../../src/core/Priority.js"

describe("Extension", () => {
  it("combines contributions in vararg order", () => {
    const first = Extension.contribution("test.first", { value: 1 })
    const second = Extension.contribution("test.second", { value: 2 })

    const combined = Extension.union(first, second)

    expect(combined.contributions.map((item) => item.type)).toEqual(["test.first", "test.second"])
    expect(combined.contributions.map((item) => item.priority)).toEqual([
      Priority.Default,
      Priority.Default,
    ])
  })

  it("applies priority to the whole extension subtree", () => {
    const first = Extension.contribution("test.first", { value: 1 })
    const second = Extension.contribution("test.second", { value: 2 })

    const combined = Extension.union(first, second).pipe(Extension.priority(Priority.High))

    expect(combined.contributions.map((item) => item.priority)).toEqual([
      Priority.High,
      Priority.High,
    ])
  })

  it("does not mutate the original extension when priority is applied", () => {
    const extension = Extension.contribution("test.item", { value: 1 })
    const highPriority = extension.pipe(Extension.priority(Priority.High))

    expect(extension.contributions[0]?.priority).toBe(Priority.Default)
    expect(highPriority.contributions[0]?.priority).toBe(Priority.High)
  })
})
