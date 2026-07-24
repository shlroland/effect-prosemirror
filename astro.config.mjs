import { fileURLToPath } from "node:url"

import { defineConfig } from "astro/config"
import astrobook from "astrobook"

export default defineConfig({
  output: "static",
  srcDir: "./demo",
  vite: {
    resolve: {
      alias: {
        "effect-prosemirror": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      },
    },
  },
  integrations: [
    astrobook({
      subpath: "/playground",
      directory: "demo/stories",
      css: ["./demo/styles/demo.css"],
      title: "Effect ProseMirror Playground",
      homeContent: {
        title: "Effect ProseMirror",
        subtitle: "Interactive runtime and extension-model verification.",
        version: false,
        repo: {
          href: "https://github.com/ocavue/astrobook",
          label: "Powered by Astrobook",
        },
      },
    }),
  ],
})
