import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "effect-prosemirror": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["test/runtime/**/*.test.ts", "packages/react/test/runtime/**/*.test.tsx"],
    typecheck: {
      enabled: true,
      include: ["test/**/*.test-d.ts", "packages/react/test/**/*.test-d.ts"],
    },
  },
})
