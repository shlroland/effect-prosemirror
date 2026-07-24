import { Context, Effect, Layer, Option, type Scope } from "effect"

import type { CommandDefinition, CommandTag } from "../Command.js"
import * as EditorSchema from "../EditorSchema.js"
import {
  FinalValidationError,
  MissingServiceError,
  ServiceLayerCreationError,
  type FinalValidationDiagnostic,
} from "../Error.js"
import type { Contribution, Extension, ServiceTag } from "../Extension.js"
import * as Keymap from "../Keymap.js"
import { Priority, type Priority as PriorityValue } from "../Priority.js"

interface IndexedDefinition {
  readonly definition: CommandDefinition
  readonly priority: PriorityValue
  readonly index: number
}

export interface CompiledExtension {
  readonly registry: ReadonlyMap<CommandTag.Any, readonly CommandDefinition[]>
  readonly keymap: Keymap.StaticKeymap
}

const priorityRank: Record<PriorityValue, number> = {
  [Priority.Lowest]: 0,
  [Priority.Low]: 1,
  [Priority.Default]: 2,
  [Priority.High]: 3,
  [Priority.Highest]: 4,
}

const isCommandContribution = (
  contribution: Contribution,
): contribution is Contribution<"command.definitions", readonly CommandDefinition[]> =>
  contribution.type === "command.definitions"

const collectDefinitions = (extension: Extension.Any): readonly IndexedDefinition[] => {
  const definitions: IndexedDefinition[] = []
  let index = 0

  for (const contribution of extension.contributions) {
    if (!isCommandContribution(contribution)) continue

    for (const definition of contribution.payload) {
      definitions.push({ definition, priority: contribution.priority, index })
      index += 1
    }
  }

  return definitions.sort((left, right) => {
    const priorityDifference = priorityRank[right.priority] - priorityRank[left.priority]
    return priorityDifference === 0 ? left.index - right.index : priorityDifference
  })
}

const collectRuntimeDiagnostics = (
  extension: Extension.Any,
  definitions: readonly IndexedDefinition[],
  keymap: Keymap.StaticKeymap,
): readonly FinalValidationDiagnostic[] => {
  const diagnostics: FinalValidationDiagnostic[] = [...EditorSchema.collect(extension).diagnostics]
  const commandTagsByName = new Map<string, CommandTag.Any>()
  const duplicateNames = new Set<string>()
  const implementedTags = new Set(definitions.map(({ definition }) => definition.tag))
  const allTags = [
    ...definitions.map(({ definition }) => definition.tag),
    ...keymap.bindings.map(({ invocation }) => invocation.tag),
  ]

  for (const tag of allTags) {
    const existing = commandTagsByName.get(tag.commandName)

    if (!existing) {
      commandTagsByName.set(tag.commandName, tag)
    } else if (existing !== tag) {
      duplicateNames.add(tag.commandName)
    }
  }

  for (const command of duplicateNames) {
    diagnostics.push({ _tag: "DuplicateCommandName", command })
  }

  const missingTags = new Set<CommandTag.Any>()
  for (const { invocation } of keymap.bindings) {
    if (!implementedTags.has(invocation.tag)) missingTags.add(invocation.tag)
  }
  for (const tag of missingTags) {
    diagnostics.push({ _tag: "MissingCommandImplementation", command: tag.commandName })
  }

  return diagnostics
}

const buildRegistry = (
  definitions: readonly IndexedDefinition[],
): ReadonlyMap<CommandTag.Any, readonly CommandDefinition[]> => {
  const registry = new Map<CommandTag.Any, CommandDefinition[]>()

  for (const { definition } of definitions) {
    const chain = registry.get(definition.tag)
    if (chain) chain.push(definition)
    else registry.set(definition.tag, [definition])
  }

  return registry
}

export const compile = (extension: Extension.Any): CompiledExtension => {
  const definitions = collectDefinitions(extension)
  const keymap = Keymap.collect(extension)
  const diagnostics = collectRuntimeDiagnostics(extension, definitions, keymap)
  if (diagnostics.length > 0) throw new FinalValidationError({ diagnostics })

  return { registry: buildRegistry(definitions), keymap }
}

const isServiceRequirementContribution = (
  contribution: Contribution,
): contribution is Contribution<"service.requirement", ServiceTag> =>
  contribution.type === "service.requirement"

const collectServiceRequirements = (extension: Extension.Any): readonly ServiceTag[] => {
  const requirements = new Map<string, ServiceTag>()

  for (const contribution of extension.contributions) {
    if (!isServiceRequirementContribution(contribution)) continue
    requirements.set(contribution.payload.key, contribution.payload)
  }

  return [...requirements.values()]
}

const missingServices = (
  requirements: readonly ServiceTag[],
  context: Context.Context<any>,
): readonly string[] =>
  requirements.flatMap((tag) => (Option.isNone(Context.getOption(tag)(context)) ? [tag.key] : []))

export const validateServiceRequirements = <Requirement>(
  extension: Extension.Any,
): Effect.Effect<void, MissingServiceError, Requirement> =>
  Effect.contextWith<Requirement, readonly string[]>((context) =>
    missingServices(collectServiceRequirements(extension), context),
  ).pipe(
    Effect.flatMap((services) =>
      services.length === 0 ? Effect.void : Effect.fail(new MissingServiceError({ services })),
    ),
  )

export const buildSynchronousServiceContext = (
  extension: Extension.Any,
  scope: Scope.CloseableScope,
  layer: Layer.Layer<any, unknown, never> | undefined,
): void => {
  let context: Context.Context<never> | undefined

  try {
    context = layer
      ? (Effect.runSync(Layer.buildWithScope(layer, scope)) as unknown as Context.Context<never>)
      : Context.empty()
  } catch (cause) {
    throw new ServiceLayerCreationError({ cause })
  }

  const services = missingServices(
    collectServiceRequirements(extension),
    context as unknown as Context.Context<any>,
  )
  if (services.length > 0) throw new MissingServiceError({ services })
}
