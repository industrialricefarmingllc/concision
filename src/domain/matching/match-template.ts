import type { VariableCounter } from "../language/variable-counter"
import type { LineNode, TemplateDocument, TemplateNode } from "../language/types"
import { highlightDiagnostic } from "./diagnostic-highlight"
import { explainLineMismatch, formatLinePattern } from "./line-matches"
import { matchNodes } from "./match-nodes"
import { sourceLines } from "./source-lines"

export type TemplateMatch = {
  valid: boolean
  errors: string[]
  warnings: string[]
  sourceLine?: number
}

type Diagnostic = {
  message: string
  sourceLine?: number
}

export type MatchTemplateInput = {
  filePath: string
  content: string
  variableCounter?: VariableCounter
}

export function matchTemplate(template: TemplateDocument, input: MatchTemplateInput): TemplateMatch {
  const lines = sourceLines(input.content)
  const endings = matchNodes(template.nodes, lines, 0, {
    filePath: input.filePath,
    variableCounter: input.variableCounter,
  })
  const valid = endings.includes(lines.length)
  const diagnostic = valid ? undefined : diagnoseTemplateMismatch(template, lines, input)

  return {
    valid,
    errors: diagnostic ? [diagnostic.message] : [],
    warnings: [],
    sourceLine: diagnostic?.sourceLine,
  }
}

function diagnoseTemplateMismatch(template: TemplateDocument, lines: string[], input: MatchTemplateInput): Diagnostic {
  return diagnoseNodes(template, template.nodes, lines, input, 0)
}

function diagnoseNodes(template: TemplateDocument, nodes: TemplateNode[], lines: string[], input: MatchTemplateInput, start: number): Diagnostic {
  const context = {
    filePath: input.filePath,
    variableCounter: input.variableCounter,
  }
  let positions = [start]

  for (const node of nodes) {
    const position = bestPosition(positions)
    if (node.kind === "optional" && nodeStartsAt(node.nodes, lines, position, input)) {
      const endings = matchNodes(node.nodes, lines, position, context)
      if (endings.length === 0) return diagnoseNodes(template, node.nodes, lines, input, position)
    }

    const next = unique(positions.flatMap((position) => matchNodes([node], lines, position, context)))
    if (next.length === 0) return describeNodeFailure(template, node, lines, position, context)
    positions = next
  }

  const extraPosition = positions.filter((position) => position < lines.length).sort((a, b) => b - a)[0]
  if (extraPosition !== undefined) {
    const firstNode = nodes[0]
    if (extraPosition === start && firstNode) return describeNodeFailure(template, firstNode, lines, extraPosition, context)

    return diagnostic({
      template: template.path,
      sourceLine: extraPosition + 1,
      rule: "end of template",
      actual: lines[extraPosition] ?? "",
      problem: "The template has additional content after all rules matched.",
      fix: "Remove the extra source line.",
    })
  }

  return diagnostic({
    template: template.path,
    rule: "complete template match",
    actual: "end of file",
    problem: "The template ended before it could be fully matched.",
    fix: "Add the missing source structure required by the template.",
  })
}

function nodeStartsAt(nodes: TemplateNode[], lines: string[], position: number, input: MatchTemplateInput): boolean {
  const first = nodes[0]
  if (!first) return false

  const context = {
    filePath: input.filePath,
    variableCounter: input.variableCounter,
    warn: () => undefined,
  }

  return matchNodes([first], lines, position, context).some((ending) => ending > position)
}

function bestPosition(positions: number[]): number {
  return positions.reduce((best, position) => Math.max(best, position), positions[0] ?? 0)
}

function describeNodeFailure(template: TemplateDocument, node: TemplateNode, lines: string[], position: number, context: { filePath: string; variableCounter?: VariableCounter }): Diagnostic {
  if (node.kind === "line") return describeLineFailure(template, node, lines, position)

  if (node.kind === "alternation") {
    const expected = node.choices.map((choice) => choice.map(formatNode).filter(Boolean).join(" ↵ ")).join(" | ")
    const span = failureSpan(node, lines, position, context)
    const offset = failureOffset(node, lines, position, context)
    return diagnostic({
      template: template.path,
      sourceLine: position + offset + 1,
      rule: expected,
      actual: formatSourceBlock(lines, position, span, offset),
      problem: "Not matching OR conditions.",
      fix: "Change the source to match one of the allowed alternatives.",
    })
  }

  const span = failureSpan(node, lines, position, context)
  const offset = failureOffset(node, lines, position, context)
  return diagnostic({
    template: template.path,
    sourceLine: position + offset + 1,
    rule: node.nodes.map(formatNode).filter(Boolean).join(" ↵ ") || "optional block",
    actual: formatSourceBlock(lines, position, span, offset),
    problem: "The rule block did not match at this location and the template could not continue.",
    fix: "Either remove the partial optional structure from the source or complete it so it matches the rule.",
  })
}

function describeLineFailure(template: TemplateDocument, node: LineNode, lines: string[], position: number): Diagnostic {
  const actual = lines[position]
  if (actual === undefined) {
    return diagnostic({
      template: template.path,
      rule: formatLinePattern(node.pattern),
      actual: highlightDiagnostic("end of file"),
      problem: "The rule requires another source line, but the file ended first.",
      fix: "Add the missing line to the source file.",
    })
  }

  const mismatch = explainLineMismatch(node.pattern, actual)
  return diagnostic({
    template: template.path,
    sourceLine: position + 1,
    rule: mismatch.expected,
    actual: highlightDiagnostic(actual),
    problem: mismatch.problem,
    fix: mismatch.fix,
  })
}

function formatNode(node: TemplateNode): string {
  if (node.kind === "line") return formatLinePattern(node.pattern)
  if (node.kind === "alternation") return node.choices.map((choice) => choice.map(formatNode).filter(Boolean).join(" ↵ ")).join(" | ")
  return node.nodes.map(formatNode).filter(Boolean).join(" ↵ ")
}

function failureSpan(node: TemplateNode, lines: string[], position: number, context: { filePath: string; variableCounter?: VariableCounter }): number {
  return Math.max(1, failureEndForNode(node, lines, position, context) - position)
}

function failureOffset(node: TemplateNode, lines: string[], position: number, context: { filePath: string; variableCounter?: VariableCounter }): number {
  return Math.max(0, failureEndForNode(node, lines, position, context) - position - 1)
}

function failureEndForNode(node: TemplateNode, lines: string[], position: number, context: { filePath: string; variableCounter?: VariableCounter }): number {
  if (node.kind === "line") {
    const endings = matchNodes([node], lines, position, context)
    return endings.length > 0 ? Math.max(...endings) : position + 1
  }

  if (node.kind === "alternation") {
    return Math.max(position + 1, ...node.choices.map((choice) => failureEndForNodes(choice, lines, position, context)))
  }

  return failureEndForNodes(node.nodes, lines, position, context)
}

function failureEndForNodes(nodes: TemplateNode[], lines: string[], start: number, context: { filePath: string; variableCounter?: VariableCounter }): number {
  let positions = [start]
  let deepest = start

  for (const node of nodes) {
    const next = unique(positions.flatMap((position) => matchNodes([node], lines, position, context)))
    if (next.length === 0) {
      return Math.max(deepest, ...positions.map((position) => failureEndForNode(node, lines, position, context)))
    }

    deepest = Math.max(deepest, ...next)
    positions = next
  }

  return deepest
}

function formatSourceBlock(lines: string[], position: number, span: number, highlightOffset: number): string {
  const actual = []

  for (let offset = 0; offset < Math.max(1, span); offset += 1) {
    const line = lines[position + offset]
    if (line === undefined) {
      actual.push(offset === highlightOffset ? highlightDiagnostic("end of file") : "end of file")
      break
    }
    const value = line || "<blank line>"
    actual.push(offset === highlightOffset ? highlightDiagnostic(value) : value)
  }

  return actual.join(" ↵ ")
}

function diagnostic(input: { template: string; sourceLine?: number; rule: string; actual: string; problem: string; fix: string }): Diagnostic {
  return {
    message: [`Template: ${input.template}`, `Expected: ${input.rule}`, `Actual: ${input.actual || "<blank line>"}`, `${input.problem} ${input.fix}`].join("\n"),
    sourceLine: input.sourceLine,
  }
}

function unique(values: number[]): number[] {
  return [...new Set(values)]
}
