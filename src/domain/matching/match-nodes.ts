import type { VariableCounter } from "../language/variable-counter"
import type { LineNode, TemplateNode } from "../language/types"
import { lineMatches } from "./line-matches"

export type MatchContext = {
  filePath: string
  variableCounter?: VariableCounter
}

export function matchNodes(nodes: TemplateNode[], lines: string[], start: number, context: MatchContext): number[] {
  return nodes.reduce(
    (positions, node) => unique(positions.flatMap((position) => matchNode(node, lines, position, context))),
    [start],
  )
}

function matchNode(node: TemplateNode, lines: string[], position: number, context: MatchContext): number[] {
  if (node.kind === "optional") return [position, ...matchNodes(node.nodes, lines, position, context)]
  if (node.kind === "alternation") return node.choices.flatMap((choice) => matchNodes(choice, lines, position, context))
  return matchLine(node, lines, position, context)
}

function matchLine(node: LineNode, lines: string[], position: number, context: MatchContext): number[] {
  if (node.pattern.repeat) return repeatPositions(node, lines, position, context)
  if (lineMatches(node.pattern, lines[position] ?? "")) return [position + 1]
  return []
}

function repeatPositions(node: LineNode, lines: string[], position: number, context: MatchContext): number[] {
  const positions = [position]

  for (let next = position; next < lines.length; next += 1) {
    if (!lineMatches(node.pattern, lines[next] ?? "")) break
    if (!withinBound(node, lines.slice(position, next + 1), context)) break
    positions.push(next + 1)
  }

  return positions
}

function withinBound(node: LineNode, lines: string[], context: MatchContext): boolean {
  const max = node.pattern.repeat?.max
  if (!max) return true

  const result = context.variableCounter?.({ filePath: context.filePath, content: lines.join("\n") }) ?? { supported: false }
  if (result.supported) return result.count <= max
  return true
}

function unique(values: number[]): number[] {
  return [...new Set(values)]
}
