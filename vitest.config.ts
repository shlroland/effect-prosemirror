import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/runtime/**/*.test.ts"],
    typecheck: {
      enabled: true,
      include: ["test/**/*.test-d.ts"],
    },
  },
})
