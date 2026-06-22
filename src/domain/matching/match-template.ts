import type { VariableCounter } from "../language/variable-counter"
import type { LineNode, TemplateDocument, TemplateNode } from "../language/types"
import type { Captures } from "./line-matches"
import { highlightDiagnostic } from "./diagnostic-highlight"
import { explainLineMismatch, formatLinePattern } from "./line-matches"
import { matchNodes, matchNodesWithState, type MatchContext, type MatchState } from "./match-nodes"
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

type FailureDetail = {
  rule: string
  position: number
  end: number
  actual: string
  problem: string
  fix: string
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
  let states: MatchState[] = [{ position: start, captures: {} }]

  for (const node of nodes) {
    const state = bestState(states)
    if (node.kind === "optional" && nodeStartsAt(node.nodes, lines, state, context)) {
      const endings = matchNodesWithState(node.nodes, lines, [state], context)
      if (endings.length === 0) return diagnoseNodes(template, node.nodes, lines, input, state.position)
    }

    const next = uniqueStates(states.flatMap((state) => matchNodesWithState([node], lines, [state], context)))
    if (next.length === 0) return describeNodeFailure(template, node, lines, state, context)
    states = next
  }

  const extraState = states.filter((state) => state.position < lines.length).sort((a, b) => b.position - a.position)[0]
  if (extraState !== undefined) {
    const firstNode = nodes[0]
    if (extraState.position === start && firstNode) return describeNodeFailure(template, firstNode, lines, extraState, context)

    return diagnostic({
      template: template.path,
      sourceLine: extraState.position + 1,
      rule: "end of template",
      actual: lines[extraState.position] ?? "",
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

function nodeStartsAt(nodes: TemplateNode[], lines: string[], state: MatchState, context: MatchContext): boolean {
  const first = nodes[0]
  if (!first) return false

  return matchNodesWithState([first], lines, [state], context).some((ending) => ending.position > state.position)
}

function bestState(states: MatchState[]): MatchState {
  return states.reduce((best, state) => state.position > best.position ? state : best, states[0] ?? { position: 0, captures: {} })
}

function describeNodeFailure(template: TemplateDocument, node: TemplateNode, lines: string[], state: MatchState, context: MatchContext): Diagnostic {
  if (node.kind === "line") return describeLineFailure(template, node, lines, state.position, state.captures)

  if (node.kind === "alternation") {
    const detail = bestFailureDetail(node.choices.map((choice) => failureDetailForNodes(choice, lines, state, context)))
    if (detail) {
      return diagnostic({
        template: template.path,
        sourceLine: detail.position + 1,
        rule: detail.rule,
        actual: detail.actual,
        problem: detail.problem,
        fix: detail.fix,
      })
    }

    const expected = node.choices.map(formatNodes).join(" | ")
    const span = failureSpan(node, lines, state, context)
    const offset = failureOffset(node, lines, state, context)
    return diagnostic({
      template: template.path,
      sourceLine: state.position + offset + 1,
      rule: expected,
      actual: formatSourceBlock(lines, state.position, span, offset),
      problem: "Not matching OR conditions.",
      fix: "Change the source to match one of the allowed alternatives.",
    })
  }

  const span = failureSpan(node, lines, state, context)
  const offset = failureOffset(node, lines, state, context)
  return diagnostic({
    template: template.path,
    sourceLine: state.position + offset + 1,
    rule: node.nodes.map(formatNode).filter(Boolean).join(" ↵ ") || "optional block",
    actual: formatSourceBlock(lines, state.position, span, offset),
    problem: "The rule block did not match at this location and the template could not continue.",
    fix: "Either remove the partial optional structure from the source or complete it so it matches the rule.",
  })
}

function describeLineFailure(template: TemplateDocument, node: LineNode, lines: string[], position: number, captures: Captures = {}): Diagnostic {
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

  const mismatch = explainLineMismatch(node.pattern, lines, position, captures)
  return diagnostic({
    template: template.path,
    sourceLine: position + mismatch.highlightOffset + 1,
    rule: mismatch.expected,
    actual: formatSourceBlock(lines, position, mismatch.span, mismatch.highlightOffset),
    problem: mismatch.problem,
    fix: mismatch.fix,
  })
}

function formatNode(node: TemplateNode): string {
  if (node.kind === "line") return formatLinePattern(node.pattern)
  if (node.kind === "alternation") return node.choices.map(formatNodes).join(" | ")
  return formatNodes(node.nodes)
}

function formatNodes(nodes: TemplateNode[]): string {
  return nodes.map(formatNode).filter(Boolean).join(" ↵ ")
}

function failureSpan(node: TemplateNode, lines: string[], state: MatchState, context: MatchContext): number {
  return Math.max(1, failureEndForNode(node, lines, state, context) - state.position)
}

function failureOffset(node: TemplateNode, lines: string[], state: MatchState, context: MatchContext): number {
  return Math.max(0, failureEndForNode(node, lines, state, context) - state.position - 1)
}

function failureEndForNode(node: TemplateNode, lines: string[], state: MatchState, context: MatchContext): number {
  if (node.kind === "line") {
    const endings = matchNodesWithState([node], lines, [state], context).map((state) => state.position)
    return endings.length > 0 ? Math.max(...endings) : state.position + 1
  }

  if (node.kind === "alternation") {
    return Math.max(state.position + 1, ...node.choices.map((choice) => failureEndForNodes(choice, lines, state, context)))
  }

  return failureEndForNodes(node.nodes, lines, state, context)
}

function failureEndForNodes(nodes: TemplateNode[], lines: string[], start: MatchState, context: MatchContext): number {
  let states = [start]
  let deepest = start.position

  for (const node of nodes) {
    const next = uniqueStates(states.flatMap((state) => matchNodesWithState([node], lines, [state], context)))
    if (next.length === 0) {
      return Math.max(deepest, ...states.map((state) => failureEndForNode(node, lines, state, context)))
    }

    deepest = Math.max(deepest, ...next.map((state) => state.position))
    states = next
  }

  return deepest
}

function failureDetailForNode(node: TemplateNode, lines: string[], state: MatchState, context: MatchContext): FailureDetail {
  if (node.kind === "line") {
    const actual = lines[state.position]
    if (actual === undefined) {
      return {
        rule: formatLinePattern(node.pattern),
        position: state.position,
        end: state.position + 1,
        actual: "end of file",
        problem: "The rule requires another source line, but the file ended first.",
        fix: "Add the missing line to the source file.",
      }
    }

    const mismatch = explainLineMismatch(node.pattern, lines, state.position, state.captures)
    return {
      rule: mismatch.expected,
      position: state.position + mismatch.highlightOffset,
      end: state.position + mismatch.span,
      actual: formatSourceBlock(lines, state.position, mismatch.span, mismatch.highlightOffset),
      problem: mismatch.problem,
      fix: mismatch.fix,
    }
  }

  if (node.kind === "alternation") {
    return bestFailureDetail(node.choices.map((choice) => failureDetailForNodes(choice, lines, state, context))) ?? {
      rule: formatNode(node),
      position: state.position,
      end: state.position + 1,
      actual: formatSourceBlock(lines, state.position, 1, 0),
      problem: "Not matching OR conditions.",
      fix: "Change the source to match one of the allowed alternatives.",
    }
  }

  return failureDetailForNodes(node.nodes, lines, state, context)
}

function failureDetailForNodes(nodes: TemplateNode[], lines: string[], start: MatchState, context: MatchContext): FailureDetail {
  let states = [start]

  for (const node of nodes) {
    const next = uniqueStates(states.flatMap((state) => matchNodesWithState([node], lines, [state], context)))
    if (next.length === 0) {
      return bestFailureDetail(states.map((state) => failureDetailForNode(node, lines, state, context))) ?? {
        rule: formatNode(node),
        position: start.position,
        end: start.position + 1,
        actual: formatSourceBlock(lines, start.position, 1, 0),
        problem: "The rule does not match the source line.",
        fix: `Change the source line to match \`${formatNode(node)}\`.`,
      }
    }

    states = next
  }

  return {
    rule: nodes.map(formatNode).filter(Boolean).join(" ↵ ") || "empty rule",
    position: start.position,
    end: Math.max(start.position, ...states.map((state) => state.position)),
    actual: formatSourceBlock(lines, start.position, 1, 0),
    problem: "The rule did not fail at a more specific source line.",
    fix: "Check the surrounding rule structure.",
  }
}

function bestFailureDetail(details: Array<FailureDetail | undefined>): FailureDetail | undefined {
  return details
    .filter((detail): detail is FailureDetail => detail !== undefined)
    .sort((left, right) => right.end - left.end || right.position - left.position)[0]
}

function formatSourceBlock(lines: string[], position: number, span: number, highlightOffset: number): string {
  const actual = []

  for (let offset = 0; offset < Math.max(1, span); offset += 1) {
    const line = lines[position + offset]
    if (line === undefined) {
      actual.push("end of file")
      break
    }
    const value = line || "<blank line>"
    actual.push(offset === highlightOffset ? highlightDiagnostic(value) : value)
  }

  return actual.join(" ↵ ")
}

function diagnostic(input: { template: string; sourceLine?: number; rule: string; actual: string; problem: string; fix: string }): Diagnostic {
  return {
    message: [
      `Template: ${input.template}`,
      `Expected: ${input.rule}`,
      `Actual: ${input.actual || "<blank line>"}`,
      `${input.problem} ${input.fix}`,
    ].filter(Boolean).join("\n"),
    sourceLine: input.sourceLine,
  }
}

function unique(values: number[]): number[] {
  return [...new Set(values)]
}

function uniqueStates(values: MatchState[]): MatchState[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = `${value.position}:${captureKey(value.captures)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function captureKey(captures: Captures): string {
  return Object.entries(captures).sort(([left], [right]) => left.localeCompare(right)).map(([id, capture]) => `${id}=${capture}`).join(";")
}
