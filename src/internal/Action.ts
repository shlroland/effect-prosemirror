import { Context, Effect } from "effect"
import type { Schema } from "prosemirror-model"
import type { EditorState, Transaction } from "prosemirror-state"

import {
  ActionReentryError,
  ActionNotAvailableError,
  EditorDestroyedError,
  TrackedSelectionEmptyError,
  TrackedTargetLostError,
} from "./Error.js"

const ActionTagTypeId = Symbol("effect-prosemirror/ActionTag")
const ActionDefinitionTypeId = Symbol("effect-prosemirror/ActionDefinition")
const TrackedSelectionStateTypeId = Symbol("effect-prosemirror/TrackedSelectionState")
declare const ActionRequirementsTypeId: unique symbol

type MutableTuple<Args extends readonly unknown[]> = Args extends readonly [...infer Values]
  ? Values
  : never

type IsAny<Value> = 0 extends 1 & Value ? true : false

export interface ActionTag<
  Self,
  Name extends string,
  Args extends readonly unknown[],
  Success,
  Failure,
> {
  readonly _tag: "ActionTag"
  readonly actionName: Name
  readonly [ActionTagTypeId]: {
    readonly _Self: (_: Self) => Self
    readonly _Args: Args
    readonly _Success: Success
    readonly _Failure: Failure
  }
}

export namespace ActionTag {
  export type Any = ActionTag<any, string, any, any, any>
  export type Name<Tag extends Any> =
    Tag extends ActionTag<any, infer Name, any, any, any> ? Name : never
  export type Args<Tag extends Any> =
    IsAny<Tag> extends true
      ? any[]
      : Tag extends ActionTag<any, any, infer Args, any, any>
        ? MutableTuple<Args>
        : never
  export type Success<Tag extends Any> =
    Tag extends ActionTag<any, any, any, infer Success, any> ? Success : never
  export type Failure<Tag extends Any> =
    Tag extends ActionTag<any, any, any, any, infer Failure> ? Failure : never
}

export interface ActionTagClass<
  Self,
  Name extends string,
  Args extends readonly unknown[],
  Success,
  Failure,
> extends ActionTag<Self, Name, Args, Success, Failure> {
  new (_: never): ActionTagClassShape<Name, Args, Success, Failure>
}

export interface ActionTagClassShape<
  Name extends string,
  Args extends readonly unknown[],
  Success,
  Failure,
> {
  readonly [ActionTagTypeId]: typeof ActionTagTypeId
  readonly Name: Name
  readonly Args: Args
  readonly Success: Success
  readonly Failure: Failure
}

export const Tag =
  <const Name extends string>(actionName: Name) =>
  <Self, Args extends readonly unknown[], Success, Failure>(): ActionTagClass<
    Self,
    Name,
    Args,
    Success,
    Failure
  > => {
    function TagClass() {}

    Object.defineProperties(TagClass, {
      _tag: { value: "ActionTag", enumerable: true },
      actionName: { value: actionName, enumerable: true },
      [ActionTagTypeId]: { value: undefined },
    })

    return TagClass as unknown as ActionTagClass<Self, Name, Args, Success, Failure>
  }

export interface Definition<Tag extends ActionTag.Any = ActionTag.Any, Requirements = never> {
  readonly _tag: "ActionDefinition"
  readonly [ActionDefinitionTypeId]: typeof ActionDefinitionTypeId
  readonly [ActionRequirementsTypeId]: Requirements
  readonly tag: Tag
  readonly run: (
    ...args: ActionTag.Args<Tag>
  ) => Effect.Effect<
    ActionTag.Success<Tag>,
    ActionTag.Failure<Tag> | RuntimeError,
    Requirements | ActionRuntimeContext
  >
}

export namespace Definition {
  export type Requirements<Value> = Value extends {
    readonly [ActionRequirementsTypeId]: infer Requirements
  }
    ? Requirements
    : never
}

export type ActionDefinition<Tag extends ActionTag.Any = any, Requirements = any> = Definition<
  Tag,
  Requirements
>

export const define = <const Tag extends ActionTag.Any, Requirements>(
  tag: Tag,
  run: (
    ...args: ActionTag.Args<Tag>
  ) => Effect.Effect<ActionTag.Success<Tag>, ActionTag.Failure<Tag> | RuntimeError, Requirements>,
): Definition<Tag, Exclude<Requirements, ActionRuntimeContext>> =>
  ({
    _tag: "ActionDefinition",
    [ActionDefinitionTypeId]: ActionDefinitionTypeId,
    tag,
    run: run as Definition<Tag, Exclude<Requirements, ActionRuntimeContext>>["run"],
  }) as Definition<Tag, Exclude<Requirements, ActionRuntimeContext>>

export interface TrackedSelection {
  readonly _tag: "TrackedSelection"
  readonly snapshot: {
    readonly text: string
    readonly empty: boolean
  }
  readonly [TrackedSelectionStateTypeId]: TrackedSelectionState
}

export interface TrackedSelectionState {
  from: number
  to: number
  changed: boolean
  lost: boolean
  active: boolean
}

export const makeTrackedSelection = (options: {
  readonly from: number
  readonly to: number
  readonly text: string
}): TrackedSelection =>
  Object.freeze({
    _tag: "TrackedSelection",
    snapshot: Object.freeze({
      text: options.text,
      empty: options.from === options.to,
    }),
    [TrackedSelectionStateTypeId]: {
      from: options.from,
      to: options.to,
      changed: false,
      lost: false,
      active: true,
    },
  })

export const trackedSelectionState = (target: TrackedSelection): TrackedSelectionState =>
  target[TrackedSelectionStateTypeId]

export interface ReentryTarget {
  readonly from: number
  readonly to: number
  readonly changed: boolean
}

export interface ReentryContext {
  readonly state: EditorState
  readonly schema: Schema
  readonly tr: Transaction
  readonly target: ReentryTarget
}

export type ReentryDecision<Success, Failure> =
  | {
      readonly _tag: "Apply"
      readonly transaction: Transaction
      readonly value: Success
    }
  | {
      readonly _tag: "Reject"
      readonly error: Failure
    }

export const apply = <Success>(
  transaction: Transaction,
  value: Success,
): ReentryDecision<Success, never> => ({
  _tag: "Apply",
  transaction,
  value,
})

export const reject = <Failure>(error: Failure): ReentryDecision<never, Failure> => ({
  _tag: "Reject",
  error,
})

export interface ActionRuntime {
  readonly trackSelection: (options: {
    readonly requireNonEmpty: boolean
  }) => Effect.Effect<TrackedSelection, TrackedSelectionEmptyError | EditorDestroyedError>
  readonly reenter: <Success, Failure>(
    target: TrackedSelection,
    callback: (context: ReentryContext) => ReentryDecision<Success, Failure>,
  ) => Effect.Effect<
    Success,
    Failure | TrackedTargetLostError | EditorDestroyedError | ActionReentryError
  >
}

export class ActionRuntimeContext extends Context.Tag("effect-prosemirror/ActionRuntime")<
  ActionRuntimeContext,
  ActionRuntime
>() {}

export const trackSelection = (options: {
  readonly requireNonEmpty: boolean
}): Effect.Effect<
  TrackedSelection,
  TrackedSelectionEmptyError | EditorDestroyedError,
  ActionRuntimeContext
> => Effect.flatMap(ActionRuntimeContext, (runtime) => runtime.trackSelection(options))

export const reenter = <Success, Failure>(
  target: TrackedSelection,
  callback: (context: ReentryContext) => ReentryDecision<Success, Failure>,
): Effect.Effect<
  Success,
  Failure | TrackedTargetLostError | EditorDestroyedError | ActionReentryError,
  ActionRuntimeContext
> => Effect.flatMap(ActionRuntimeContext, (runtime) => runtime.reenter(target, callback))

export type RuntimeError =
  | ActionNotAvailableError
  | EditorDestroyedError
  | TrackedSelectionEmptyError
  | TrackedTargetLostError
  | ActionReentryError
