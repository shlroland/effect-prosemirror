import { useContext } from "react"

import { AdapterContext, type AdapterContextValue } from "./context.js"

export const useAdapter = (): AdapterContextValue => {
  const value = useContext(AdapterContext)
  if (value === null) {
    throw new Error("React adapter hooks require EditorProvider")
  }
  return value
}
