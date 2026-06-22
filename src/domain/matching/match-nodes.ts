import type { VariableCounter } from "../language/variable-counter"
import type { LineNode, TemplateNode } from "../language/types"
import { hasInlineRepeat, inlineRepeatEndings, lineStructureMatches, matchLinePattern, type Captures } from "./line-matches"

export type MatchContext = {
  filePath: string
  variableCounter?: VariableCounter
}

export type MatchState = {
  position: number
  captures: Captures
}

export function matchNodes(nodes: TemplateNode[], lines: string[], start: number, context: MatchContext): number[] {
  return uniquePositions(matchNodesWithState(nodes, lines, [{ position: start, captures: {} }], context).map((state) => state.position))
}

export function matchNodesWithState(nodes: TemplateNode[], lines: string[], states: MatchState[], context: MatchContext): MatchState[] {
  return nodes.reduce((states, node) => uniqueStates(states.flatMap((state) => matchNode(node, lines, state, context))), states)
}

function matchNode(node: TemplateNode, lines: string[], state: MatchState, context: MatchContext): MatchState[] {
  if (node.kind === "optional") return matchOptional(node.nodes, lines, state, context)
  if (node.kind === "alternation") return node.choices.flatMap((choice) => matchNodesWithState(choice, lines, [state], context))
  return matchLine(node, lines, state, context)
}

function matchOptional(nodes: TemplateNode[], lines: string[], state: MatchState, context: MatchContext): MatchState[] {
  const endings = matchNodesWithState(nodes, lines, [state], context).filter((ending) => ending.position > state.position)
  if (canAlwaysSkipOptional(nodes[0])) return [state, ...endings]
  if (nodeStartsAt(nodes[0], lines, state, context)) return endings
  return [state, ...endings]
}

function canAlwaysSkipOptional(node: TemplateNode | undefined): boolean {
  if (!node) return true
  if (node.kind !== "line") return false
  return node.pattern.repeat !== null && node.pattern.parts.length === 0 && node.pattern.constraints.length === 0
}

function nodeStartsAt(node: TemplateNode | undefined, lines: string[], state: MatchState, context: MatchContext): boolean {
  if (!node) return false
  if (node.kind === "optional") return nodeStartsAt(node.nodes[0], lines, state, context)
  if (node.kind === "alternation") return node.choices.some((choice) => matchNodesWithState(choice, lines, [state], context).some((ending) => ending.position > state.position))
  return matchLine(node, lines, state, context).some((ending) => ending.position > state.position)
}

function matchLine(node: LineNode, lines: string[], state: MatchState, context: MatchContext): MatchState[] {
  if (hasInlineRepeat(node.pattern)) return inlineRepeatPositions(node, lines, state, context)
  if (node.pattern.repeat) return repeatPositions(node, lines, state, context)
  const matches = matchLinePattern(node.pattern, lines[state.position] ?? "", state.captures)
  // Constraint-only patterns (no parts) are assertions:
  // a non-consuming variant lets the next template node match the same line;
  // a consuming variant lets the assertion stand alone at the end of the template.
  if (node.pattern.parts.length === 0 && node.pattern.constraints.length > 0) {
    return [
      ...matches.map((match) => ({ position: state.position, captures: match.captures })),
      ...matches.map((match) => ({ position: state.position + 1, captures: match.captures })),
    ]
  }
  return matches.map((match) => ({ position: state.position + 1, captures: match.captures }))
}

function inlineRepeatPositions(node: LineNode, lines: string[], state: MatchState, context: MatchContext): MatchState[] {
  return inlineRepeatEndings(node.pattern, lines, state.position, state.captures)
    .filter((match) => withinBound(node, lines.slice(state.position, match.end), context))
    .map((match) => ({ position: match.end, captures: match.captures }))
}

function repeatPositions(node: LineNode, lines: string[], state: MatchState, context: MatchContext): MatchState[] {
  const positions = [state]
  let active = [state]

  for (let next = state.position; next < lines.length; next += 1) {
    const nextStates = active.flatMap((activeState) => {
      return matchLinePattern(node.pattern, lines[next] ?? "", activeState.captures).map((match) => ({ position: next + 1, captures: match.captures }))
    })
    if (nextStates.length === 0 && hasExcludeConstraint(node) && active.some((activeState) => lineStructureMatches(node.pattern, lines[next] ?? "", activeState.captures))) return []
    active = nextStates.filter((nextState) => withinBound(node, lines.slice(state.position, nextState.position), context))
    if (active.length === 0) break
    positions.push(...active)
  }

  return uniqueStates(positions)
}

function hasExcludeConstraint(node: LineNode): boolean {
  return node.pattern.constraints.some((constraint) => constraint.kind === "exclude") || node.pattern.parts.some((part) => part.kind === "wildcard" && part.constraints.some((constraint) => constraint.kind === "exclude"))
}

function withinBound(node: LineNode, lines: string[], context: MatchContext): boolean {
  const max = node.pattern.repeat?.max
  if (!max) return true

  const result = context.variableCounter?.({ filePath: context.filePath, content: lines.join("\n") }) ?? { supported: false }
  if (result.supported) return result.count <= max
  return true
}

function uniquePositions(values: number[]): number[] {
  return [...new Set(values)]
}

function uniqueStates(values: MatchState[]): MatchState[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = `${value.position}:${Object.entries(value.captures).sort(([left], [right]) => left.localeCompare(right)).map(([id, capture]) => `${id}=${capture}`).join(";")}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
