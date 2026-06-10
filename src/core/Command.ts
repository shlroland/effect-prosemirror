export interface CommandDefinition<Run extends (...args: any[]) => unknown = (...args: any[]) => unknown> {
  readonly _tag: "CommandDefinition"
  readonly run: Run
}

export const define = <const Run extends (...args: any[]) => unknown>(options: {
  readonly run: Run
}): CommandDefinition<Run> => ({
  _tag: "CommandDefinition",
  run: options.run,
})
