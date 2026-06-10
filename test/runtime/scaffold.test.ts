import { describe, expect, it } from "vitest"

import { Priority } from "../../src/core/Priority.js"

describe("scaffold", () => {
  it("exports priority values", () => {
    expect(Priority.High).toBe("high")
  })
})
