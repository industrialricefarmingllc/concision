import type { VariableCounter } from "../language/variable-counter"
import type { LineNode, TemplateNode } from "../language/types"
import { hasInlineRepeat, inlineRepeatEndings, lineMatches } from "./line-matches"

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
  if (node.kind === "optional") return matchOptional(node.nodes, lines, position, context)
  if (node.kind === "alternation") return node.choices.flatMap((choice) => matchNodes(choice, lines, position, context))
  return matchLine(node, lines, position, context)
}

function matchOptional(nodes: TemplateNode[], lines: string[], position: number, context: MatchContext): number[] {
  const endings = matchNodes(nodes, lines, position, context).filter((ending) => ending > position)
  if (nodeStartsAt(nodes[0], lines, position, context)) return endings
  return [position, ...endings]
}

function nodeStartsAt(node: TemplateNode | undefined, lines: string[], position: number, context: MatchContext): boolean {
  if (!node) return false
  if (node.kind === "optional") return nodeStartsAt(node.nodes[0], lines, position, context)
  if (node.kind === "alternation") return node.choices.some((choice) => matchNodes(choice, lines, position, context).some((ending) => ending > position))
  return matchLine(node, lines, position, context).some((ending) => ending > position)
}

function matchLine(node: LineNode, lines: string[], position: number, context: MatchContext): number[] {
  if (hasInlineRepeat(node.pattern)) return inlineRepeatPositions(node, lines, position, context)
  if (node.pattern.repeat) return repeatPositions(node, lines, position, context)
  if (lineMatches(node.pattern, lines[position] ?? "")) return [position + 1]
  return []
}

function inlineRepeatPositions(node: LineNode, lines: string[], position: number, context: MatchContext): number[] {
  return inlineRepeatEndings(node.pattern, lines, position).filter((end) => withinBound(node, lines.slice(position, end), context))
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
