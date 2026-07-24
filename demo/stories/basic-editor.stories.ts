import BasicEditor from "../components/basic-editor.astro"

export default {
  component: BasicEditor,
}

export const BasicEditorStory = {
  args: {
    initialText: "This Astrobook story mounts the real editor runtime.",
  },
}
