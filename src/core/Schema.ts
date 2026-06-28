import type {
  MarkSpec as ProseMirrorMarkSpec,
  NodeSpec as ProseMirrorNodeSpec,
} from "prosemirror-model"

import type { Contribution, Extension, NamedMarkSpec, NamedNodeSpec } from "./Extension.js"
import { Priority, type Priority as PriorityValue } from "./Priority.js"

export interface SchemaContributions {
  readonly nodes: Readonly<Record<string, NamedNodeSpec>>
  readonly marks: Readonly<Record<string, NamedMarkSpec>>
}

interface IndexedContribution<Spec> {
  readonly spec: Spec
  readonly priority: PriorityValue
  readonly index: number
}

const priorityRank: Record<PriorityValue, number> = {
  [Priority.Lowest]: 0,
  [Priority.Low]: 1,
  [Priority.Default]: 2,
  [Priority.High]: 3,
  [Priority.Highest]: 4,
}

const isNodeSpecContribution = (
  contribution: Contribution,
): contribution is Contribution<"schema.nodeSpec", NamedNodeSpec> =>
  contribution.type === "schema.nodeSpec"

const isMarkSpecContribution = (
  contribution: Contribution,
): contribution is Contribution<"schema.markSpec", NamedMarkSpec> =>
  contribution.type === "schema.markSpec"

const compareContributionOrder = <Spec>(
  left: IndexedContribution<Spec>,
  right: IndexedContribution<Spec>,
): number => {
  const priorityDifference = priorityRank[left.priority] - priorityRank[right.priority]

  return priorityDifference === 0 ? left.index - right.index : priorityDifference
}

const mergeSpec = <Spec extends NamedNodeSpec | NamedMarkSpec>(
  left: Spec | undefined,
  right: Spec,
): Spec => {
  if (!left) {
    return { ...right }
  }

  const merged = {
    ...left,
    ...right,
  }

  if (left.attrs || right.attrs) {
    merged.attrs = {
      ...left.attrs,
      ...right.attrs,
    }
  }

  if (left.parseDOM || right.parseDOM) {
    merged.parseDOM = [
      ...(left.parseDOM ?? []),
      ...(right.parseDOM ?? []),
    ]
  }

  return merged
}

const mergeNamedSpecs = <Spec extends NamedNodeSpec | NamedMarkSpec>(
  contributions: readonly IndexedContribution<Spec>[],
): Readonly<Record<string, Spec>> => {
  const sorted = [...contributions].sort(compareContributionOrder)
  const specs: Record<string, Spec> = {}

  for (const contribution of sorted) {
    specs[contribution.spec.name] = mergeSpec(specs[contribution.spec.name], contribution.spec)
  }

  return specs
}

export const collect = (extension: Extension.Any): SchemaContributions => {
  const nodes: Array<IndexedContribution<NamedNodeSpec>> = []
  const marks: Array<IndexedContribution<NamedMarkSpec>> = []

  extension.contributions.forEach((contribution, index) => {
    if (isNodeSpecContribution(contribution)) {
      nodes.push({ spec: contribution.payload, priority: contribution.priority, index })
      return
    }

    if (isMarkSpecContribution(contribution)) {
      marks.push({ spec: contribution.payload, priority: contribution.priority, index })
    }
  })

  return {
    nodes: mergeNamedSpecs(nodes),
    marks: mergeNamedSpecs(marks),
  }
}

export type NodeSpec = ProseMirrorNodeSpec
export type MarkSpec = ProseMirrorMarkSpec
