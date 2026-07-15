import { Data } from "effect"
import type {
  AttributeSpec,
  DOMOutputSpec,
  MarkSpec as ProseMirrorMarkSpec,
  NodeSpec as ProseMirrorNodeSpec,
  ParseRule,
  TagParseRule,
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

const indexNodeSpecAttrs = (
  contribution: Contribution<"schema.nodeSpec", NamedNodeSpec>,
  index: number,
): readonly IndexedContribution<NodeAttrSpec>[] =>
  Object.entries(contribution.payload.attrs ?? {}).map(([attr, spec]) => ({
    spec: { type: contribution.payload.name, attr, spec },
    priority: contribution.priority,
    index,
  }))

const indexMarkSpecAttrs = (
  contribution: Contribution<"schema.markSpec", NamedMarkSpec>,
  index: number,
): readonly IndexedContribution<MarkAttrSpec>[] =>
  Object.entries(contribution.payload.attrs ?? {}).map(([attr, spec]) => ({
    spec: { type: contribution.payload.name, attr, spec },
    priority: contribution.priority,
    index,
  }))

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
    merged.parseDOM = [...(left.parseDOM ?? []), ...(right.parseDOM ?? [])]
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

const mergeAttr = (
  attrs: Record<string, AttributeSpec> | undefined,
  attr: string,
  spec: AttributeSpec,
) => ({
  ...attrs,
  [attr]: spec,
})

const isTagParseRule = (rule: ParseRule): rule is TagParseRule => rule.tag !== undefined

const wrapParseDOM = <Rule extends ParseRule>(
  rules: readonly Rule[] | undefined,
  attr: NodeAttrSpec | MarkAttrSpec,
): readonly Rule[] | undefined => {
  if (!rules || !attr.parseDOM) {
    return rules
  }

  return rules.map((rule) => {
    if (!isTagParseRule(rule)) {
      return rule
    }

    const getAttrs = rule.getAttrs

    return {
      ...rule,
      getAttrs(element: HTMLElement) {
        const attrs = getAttrs ? getAttrs(element) : (rule.attrs ?? null)

        if (attrs === false) {
          return false
        }

        return {
          ...attrs,
          [attr.attr]: attr.parseDOM?.(element),
        }
      },
    } as Rule
  })
}

const applyDOMAttr = (
  output: DOMOutputSpec,
  domAttr: readonly [name: string, value: string] | null,
): DOMOutputSpec => {
  if (!domAttr) {
    return output
  }

  const [name, value] = domAttr

  if (isDOMOutputArray(output)) {
    const [tag, second, ...rest] = output
    const hasAttrs =
      second !== null &&
      typeof second === "object" &&
      !Array.isArray(second) &&
      !("nodeType" in second)

    if (hasAttrs) {
      return [tag, { ...second, [name]: value }, ...rest]
    }

    return output.length === 1
      ? [tag, { [name]: value }]
      : [tag, { [name]: value }, second, ...rest]
  }

  const element = "dom" in output ? output.dom : output
  element.setAttribute(name, value)
  return output
}

const isDOMOutputArray = (output: DOMOutputSpec): output is readonly [string, ...any[]] =>
  Array.isArray(output)

const wrapToDOM = <ToDOM extends (...args: any[]) => DOMOutputSpec>(
  toDOM: ToDOM | undefined,
  attr: NodeAttrSpec | MarkAttrSpec,
): ToDOM | undefined => {
  if (!toDOM || !attr.toDOM) {
    return toDOM
  }

  return ((...args: Parameters<ToDOM>) => {
    const output = toDOM(...args)
    const value = args[0]?.attrs[attr.attr]

    return applyDOMAttr(output, attr.toDOM?.(value) ?? null)
  }) as ToDOM
}

const mergeSchemaAttr = <Spec extends NodeAttrSpec | MarkAttrSpec>(
  left: Spec | undefined,
  right: Spec,
): Spec => {
  if (!left) {
    return right
  }

  const parseDOM = right.parseDOM ?? left.parseDOM
  const toDOM = right.toDOM ?? left.toDOM

  return {
    ...left,
    ...right,
    spec: {
      ...left.spec,
      ...right.spec,
    },
    ...(parseDOM ? { parseDOM } : {}),
    ...(toDOM ? { toDOM } : {}),
  }
}

const mergeSchemaAttrs = <Spec extends NodeAttrSpec | MarkAttrSpec>(
  contributions: readonly IndexedContribution<Spec>[],
): readonly Spec[] => {
  const attrs = new Map<string, Spec>()

  for (const contribution of [...contributions].sort(compareContributionOrder)) {
    const attr = contribution.spec
    const key = `${attr.type}\u0000${attr.attr}`

    attrs.set(key, mergeSchemaAttr(attrs.get(key), attr))
  }

  return [...attrs.values()]
}

const applyNodeAttrs = (
  nodes: Readonly<Record<string, NamedNodeSpec>>,
  attrs: readonly IndexedContribution<NodeAttrSpec>[],
  diagnostics: EditorSchemaDiagnostic[],
): Readonly<Record<string, NamedNodeSpec>> => {
  const result: Record<string, NamedNodeSpec> = { ...nodes }

  for (const attr of mergeSchemaAttrs(attrs)) {
    const node = result[attr.type]

    if (!node) {
      diagnostics.push({ _tag: "MissingNodeTarget", type: attr.type, attr: attr.attr })
      continue
    }

    const parseDOM = wrapParseDOM(node.parseDOM, attr)
    const toDOM = wrapToDOM(node.toDOM, attr)

    result[attr.type] = {
      ...node,
      attrs: mergeAttr(node.attrs, attr.attr, attr.spec),
      ...(parseDOM ? { parseDOM } : {}),
      ...(toDOM ? { toDOM } : {}),
    }
  }

  return result
}

const applyMarkAttrs = (
  marks: Readonly<Record<string, NamedMarkSpec>>,
  attrs: readonly IndexedContribution<MarkAttrSpec>[],
  diagnostics: EditorSchemaDiagnostic[],
): Readonly<Record<string, NamedMarkSpec>> => {
  const result: Record<string, NamedMarkSpec> = { ...marks }

  for (const attr of mergeSchemaAttrs(attrs)) {
    const mark = result[attr.type]

    if (!mark) {
      diagnostics.push({ _tag: "MissingMarkTarget", type: attr.type, attr: attr.attr })
      continue
    }

    const parseDOM = wrapParseDOM(mark.parseDOM, attr)
    const toDOM = wrapToDOM(mark.toDOM, attr)

    result[attr.type] = {
      ...mark,
      attrs: mergeAttr(mark.attrs, attr.attr, attr.spec),
      ...(parseDOM ? { parseDOM } : {}),
      ...(toDOM ? { toDOM } : {}),
    }
  }

  return result
}

export const collect = (extension: Extension.Any): EditorSchemaContributions => {
  const nodes: Array<IndexedContribution<NamedNodeSpec>> = []
  const marks: Array<IndexedContribution<NamedMarkSpec>> = []
  const nodeAttrs: Array<IndexedContribution<NodeAttrSpec>> = []
  const markAttrs: Array<IndexedContribution<MarkAttrSpec>> = []

  extension.contributions.forEach((contribution, index) => {
    if (isNodeSpecContribution(contribution)) {
      nodes.push({ spec: contribution.payload, priority: contribution.priority, index })
      nodeAttrs.push(...indexNodeSpecAttrs(contribution, index))
      return
    }

    if (isMarkSpecContribution(contribution)) {
      marks.push({ spec: contribution.payload, priority: contribution.priority, index })
      markAttrs.push(...indexMarkSpecAttrs(contribution, index))
      return
    }

    if (isNodeAttrContribution(contribution)) {
      nodeAttrs.push({ spec: contribution.payload, priority: contribution.priority, index })
      return
    }

    if (isMarkAttrContribution(contribution)) {
      markAttrs.push({ spec: contribution.payload, priority: contribution.priority, index })
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
