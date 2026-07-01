import { Data } from "effect"
import type {
  AttributeSpec,
  MarkSpec as ProseMirrorMarkSpec,
  NodeSpec as ProseMirrorNodeSpec,
} from "prosemirror-model"
import { Schema as ProseMirrorSchema } from "prosemirror-model"

import type {
  Contribution,
  Extension,
  MarkAttrSpec,
  NamedMarkSpec,
  NamedNodeSpec,
  NodeAttrSpec,
} from "./Extension.js"
import { Priority, type Priority as PriorityValue } from "./Priority.js"

export interface EditorSchemaContributions {
  readonly nodes: Readonly<Record<string, NamedNodeSpec>>
  readonly marks: Readonly<Record<string, NamedMarkSpec>>
  readonly diagnostics: readonly EditorSchemaDiagnostic[]
}

export interface MissingNodeTargetDiagnostic {
  readonly _tag: "MissingNodeTarget"
  readonly type: string
  readonly attr: string
}

export interface MissingMarkTargetDiagnostic {
  readonly _tag: "MissingMarkTarget"
  readonly type: string
  readonly attr: string
}

export type EditorSchemaDiagnostic = MissingNodeTargetDiagnostic | MissingMarkTargetDiagnostic

export class MissingSchemaTargetsError extends Data.TaggedError("MissingSchemaTargetsError")<{
  readonly diagnostics: readonly EditorSchemaDiagnostic[]
}> {}

export class InvalidEditorSchemaError extends Data.TaggedError("InvalidEditorSchemaError")<{
  readonly cause: unknown
}> {}

export type EditorSchemaError = MissingSchemaTargetsError | InvalidEditorSchemaError

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

const isNodeAttrContribution = (
  contribution: Contribution,
): contribution is Contribution<"schema.nodeAttr", NodeAttrSpec> =>
  contribution.type === "schema.nodeAttr"

const isMarkAttrContribution = (
  contribution: Contribution,
): contribution is Contribution<"schema.markAttr", MarkAttrSpec> =>
  contribution.type === "schema.markAttr"

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

const mergeAttr = (attrs: Record<string, AttributeSpec> | undefined, attr: string, spec: AttributeSpec) => ({
  ...attrs,
  [attr]: spec,
})

const applyNodeAttrs = (
  nodes: Readonly<Record<string, NamedNodeSpec>>,
  attrs: readonly NodeAttrSpec[],
  diagnostics: EditorSchemaDiagnostic[],
): Readonly<Record<string, NamedNodeSpec>> => {
  const result: Record<string, NamedNodeSpec> = { ...nodes }

  for (const attr of attrs) {
    const node = result[attr.type]

    if (!node) {
      diagnostics.push({ _tag: "MissingNodeTarget", type: attr.type, attr: attr.attr })
      continue
    }

    result[attr.type] = {
      ...node,
      attrs: mergeAttr(node.attrs, attr.attr, attr.spec),
    }
  }

  return result
}

const applyMarkAttrs = (
  marks: Readonly<Record<string, NamedMarkSpec>>,
  attrs: readonly MarkAttrSpec[],
  diagnostics: EditorSchemaDiagnostic[],
): Readonly<Record<string, NamedMarkSpec>> => {
  const result: Record<string, NamedMarkSpec> = { ...marks }

  for (const attr of attrs) {
    const mark = result[attr.type]

    if (!mark) {
      diagnostics.push({ _tag: "MissingMarkTarget", type: attr.type, attr: attr.attr })
      continue
    }

    result[attr.type] = {
      ...mark,
      attrs: mergeAttr(mark.attrs, attr.attr, attr.spec),
    }
  }

  return result
}

export const collect = (extension: Extension.Any): EditorSchemaContributions => {
  const nodes: Array<IndexedContribution<NamedNodeSpec>> = []
  const marks: Array<IndexedContribution<NamedMarkSpec>> = []
  const nodeAttrs: NodeAttrSpec[] = []
  const markAttrs: MarkAttrSpec[] = []

  extension.contributions.forEach((contribution, index) => {
    if (isNodeSpecContribution(contribution)) {
      nodes.push({ spec: contribution.payload, priority: contribution.priority, index })
      return
    }

    if (isMarkSpecContribution(contribution)) {
      marks.push({ spec: contribution.payload, priority: contribution.priority, index })
      return
    }

    if (isNodeAttrContribution(contribution)) {
      nodeAttrs.push(contribution.payload)
      return
    }

    if (isMarkAttrContribution(contribution)) {
      markAttrs.push(contribution.payload)
    }
  })

  const diagnostics: EditorSchemaDiagnostic[] = []
  const mergedNodes = mergeNamedSpecs(nodes)
  const mergedMarks = mergeNamedSpecs(marks)

  return {
    nodes: applyNodeAttrs(mergedNodes, nodeAttrs, diagnostics),
    marks: applyMarkAttrs(mergedMarks, markAttrs, diagnostics),
    diagnostics,
  }
}

export const create = (extension: Extension.Any): ProseMirrorSchema => {
  const contributions = collect(extension)

  if (contributions.diagnostics.length > 0) {
    throw new MissingSchemaTargetsError({
      diagnostics: contributions.diagnostics,
    })
  }

  try {
    return new ProseMirrorSchema({
      nodes: contributions.nodes,
      marks: contributions.marks,
    })
  } catch (cause) {
    throw new InvalidEditorSchemaError({ cause })
  }
}

export type NodeSpec = ProseMirrorNodeSpec
export type MarkSpec = ProseMirrorMarkSpec
