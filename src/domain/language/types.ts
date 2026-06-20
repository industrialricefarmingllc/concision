export type TemplateDocument = {
  path: string
  paths: string[]
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
}

export type AlternationNode = {
  kind: "alternation"
  choices: TemplateNode[][]
}

export type LinePattern = {
  parts: PatternPart[]
  repeat: RepeatRule | null
  constraints: Constraint[]
}

export type PatternPart = LiteralPart | WildcardPart

export type LiteralPart = {
  kind: "literal"
  value: string
}

export type WildcardPart = {
  kind: "wildcard"
}

export type RepeatRule = {
  max: number | null
  index: number
}

export type Constraint = ExcludeConstraint | RequireConstraint

export type ExcludeConstraint = {
  kind: "exclude"
  value: string
}

export type RequireConstraint = {
  kind: "require"
  value: string
}
