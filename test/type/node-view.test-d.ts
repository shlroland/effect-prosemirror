import { EditingCore, Extension } from "../../src/core.js"
import * as Basic from "../../src/extensions/basic.js"

const valid = Extension.union(
  Basic.make(),
  Extension.NodeView({
    node: "paragraph",
    create: () => ({ dom: document.createElement("p") }),
  }),
)

EditingCore.create({ extension: valid })

const invalid = Extension.union(
  Basic.make(),
  Extension.NodeView({
    node: "missing",
    create: () => ({ dom: document.createElement("div") }),
  }),
)

// @ts-expect-error NodeViews must target a node contributed by the final Extension Union.
EditingCore.create({ extension: invalid })
