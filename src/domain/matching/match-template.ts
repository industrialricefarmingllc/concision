import type { VariableCounter } from "../language/variable-counter"
import type { LineNode, TemplateDocument, TemplateNode } from "../language/types"
import { explainLineMismatch, formatLinePattern } from "./line-matches"
import { matchNodes } from "./match-nodes"
import { sourceLines } from "./source-lines"

export type TemplateMatch = {
  valid: boolean
  errors: string[]
  warnings: string[]
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

  return {
    valid,
    errors: valid ? [] : [diagnoseTemplateMismatch(template, lines, input)],
    warnings: [],
  }
}

function diagnoseTemplateMismatch(template: TemplateDocument, lines: string[], input: MatchTemplateInput): string {
  return diagnoseNodes(template, template.nodes, lines, input, 0)
}

function diagnoseNodes(template: TemplateDocument, nodes: TemplateNode[], lines: string[], input: MatchTemplateInput, start: number): string {
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
    if (next.length === 0) return describeNodeFailure(template, node, lines, position)
    positions = next
  }

  const extraPosition = positions.filter((position) => position < lines.length).sort((a, b) => a - b)[0]
  if (extraPosition !== undefined) {
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

function describeNodeFailure(template: TemplateDocument, node: TemplateNode, lines: string[], position: number): string {
  if (node.kind === "line") return describeLineFailure(template, node, lines, position)

  if (node.kind === "alternation") {
    const expected = node.choices.map((choice) => choice.map(formatNode).filter(Boolean).join(" then ")).join(" | ")
    return diagnostic({
      template: template.path,
      sourceLine: position + 1,
      rule: expected,
      actual: lines[position] ?? "end of file",
      problem: "The rule alternatives did not match here.",
      fix: "Change the source to match one of the allowed alternatives.",
    })
  }

  return diagnostic({
    template: template.path,
    sourceLine: position + 1,
    rule: node.nodes.map(formatNode).filter(Boolean).join(" then ") || "optional block",
    actual: lines[position] ?? "end of file",
    problem: "The rule block did not match at this location and the template could not continue.",
    fix: "Either remove the partial optional structure from the source or complete it so it matches the rule.",
  })
}

function describeLineFailure(template: TemplateDocument, node: LineNode, lines: string[], position: number): string {
  const actual = lines[position]
  if (actual === undefined) {
    return diagnostic({
      template: template.path,
      rule: formatLinePattern(node.pattern),
      actual: "end of file",
      problem: "The rule requires another source line, but the file ended first.",
      fix: "Add the missing line to the source file.",
    })
  }

  const mismatch = explainLineMismatch(node.pattern, actual)
  return diagnostic({
    template: template.path,
    sourceLine: position + 1,
    rule: mismatch.expected,
    actual,
    problem: mismatch.problem,
    fix: mismatch.fix,
  })
}

function formatNode(node: TemplateNode): string {
  if (node.kind === "line") return formatLinePattern(node.pattern)
  if (node.kind === "alternation") return node.choices.map((choice) => choice.map(formatNode).filter(Boolean).join(" then ")).join(" | ")
  return node.nodes.map(formatNode).filter(Boolean).join(" then ")
}

function diagnostic(input: { template: string; sourceLine?: number; rule: string; actual: string; problem: string; fix: string }): string {
  const template = input.sourceLine ? `${input.template}:${input.sourceLine}` : input.template
  return [`Template: ${template}`, `Expected: ${input.rule}`, `Actual: ${input.actual || "<blank line>"}`, `${input.problem} ${input.fix}`].filter((line): line is string => line !== null).join("\n")
}

function unique(values: number[]): number[] {
  return [...new Set(values)]
}
