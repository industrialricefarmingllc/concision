export type TemplateDocument = {
  path: string
  paths: string[]
  exclude: string[]
  nodes: TemplateNode[]
}

export type TemplateNode = LineNode | OptionalNode | AlternationNode

export type LineNode = {
  kind: "line"
  pattern: LinePattern
}

export type OptionalNode = {
  kind: "optional"
  nodes: TemplateNode[]
  params: OperatorParams
}

export type AlternationNode = {
  kind: "alternation"
  choices: TemplateNode[][]
  params: OperatorParams
}

export type LinePattern = {
  parts: PatternPart[]
  repeat: RepeatRule | null
  constraints: Constraint[]
  params: OperatorParams
}

export type PatternPart = LiteralPart | WildcardPart | CapturePart | OptionalPart

export type LiteralPart = {
  kind: "literal"
  value: string
}

export type WildcardPart = {
  kind: "wildcard"
  constraints: Constraint[]
  params: OperatorParams
}

export type CapturePart = {
  kind: "capture"
  id: number
  params: OperatorParams
}

export type OptionalPart = {
  kind: "optional"
  parts: PatternPart[]
  params: OperatorParams
}

export type RepeatRule = {
  max: number | null
  index: number
  content: string | null
}

export type OperatorParams = {
  parts: ParamPart[]
}

export type ParamPart = ParamLiteral | ParamPlaceholder

export type ParamLiteral = {
  kind: "literal"
  value: string
}

export type ParamPlaceholder = {
  kind: "placeholder"
  name: string
  values: string[]
}

export type Constraint = ExcludeConstraint | RequireConstraint | RequireRestConstraint

export type ExcludeConstraint = {
  kind: "exclude"
  value: string
}

export type RequireConstraint = {
  kind: "require"
  value: string
}

export type RequireRestConstraint = {
  kind: "requireRest"
  value: string
}
