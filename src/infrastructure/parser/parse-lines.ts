import type { TemplateNode, LineNode, OptionalNode } from "../../domain/language/types"
import { readGroup } from "./read-group"

export function parseLines(lines: string[], lineOffset = 1): TemplateNode[] {
  const nodes: TemplateNode[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const sourceLine = lineOffset + index
    const group = readGroup(lines, index, sourceLine)
    nodes.push(group.node)
    index = group.next - 1
  }

  return absorbOperatorPadding(nodes)
}

function absorbOperatorPadding(nodes: TemplateNode[]): TemplateNode[] {
  // pass 1: absorb blank after ~[...] blocks, negated rules, and alternations
  // (bare ~ and ** are handled in pass 2 with the cap)
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const node = nodes[i]
    if (!node) continue
    if (isBlankLine(nodes[i + 1]) && !isTildeMarker(node) && !isRepeatOp(node) && absorbsAfterBlank(node)) {
      nodes[i + 1] = makeOptionalBlank(nodes[i + 1])
    }
  }

  // pass 2: absorb blanks before/after bare ~ and ** operators, capped at one total
  let i = 0
  while (i < nodes.length) {
    const node = nodes[i]
    if (!node) { i += 1; continue }

    const isTarget = isTildeMarker(node) || isRepeatOp(node)
    if (!isTarget) { i += 1; continue }

    const prevBlank = i > 0 && isBlankLine(nodes[i - 1])
    const nextBlank = i + 1 < nodes.length && isBlankLine(nodes[i + 1])

    if (prevBlank && nextBlank) {
      // cap at one: before-blank wins, drop after-blank
      nodes[i - 1] = makeOptionalBlank(nodes[i - 1]!)
      nodes.splice(i + 1, 1)
      i += 1
    } else if (prevBlank) {
      nodes[i - 1] = makeOptionalBlank(nodes[i - 1]!)
      i += 1
    } else if (nextBlank) {
      nodes[i + 1] = makeOptionalBlank(nodes[i + 1]!)
      i += 2
    } else {
      i += 1
    }
  }

  return nodes
}

function isBlankLine(node: TemplateNode | undefined): node is TemplateNode {
  if (!node || node.kind !== "line") return false
  const pattern = (node as LineNode).pattern
  return pattern.parts.length === 0 && pattern.repeat === null && pattern.constraints.length === 0
}

function isTildeMarker(node: TemplateNode): boolean {
  return node.kind === "optional" && node.nodes.length === 0
}

function isRepeatOp(node: TemplateNode): boolean {
  if (node.kind !== "line") return false
  return (node as LineNode).pattern.repeat !== null && (node as LineNode).pattern.parts.length === 0
}

function absorbsAfterBlank(node: TemplateNode): boolean {
  if (node.kind === "optional") return true
  if (node.kind === "alternation") return node.choices.some((choice) => absorbsAfterBlank(choice.at(-1)!))
  if (node.kind !== "line") return false
  return isRepeatOp(node) || hasExclude(node)
}

function hasExclude(node: TemplateNode): boolean {
  if (node.kind !== "line") return false
  const pattern = (node as LineNode).pattern
  return pattern.constraints.some((c) => c.kind === "exclude") ||
    pattern.parts.some((p) => p.kind === "wildcard" && p.constraints.some((c) => c.kind === "exclude"))
}

function makeOptionalBlank(node: TemplateNode): OptionalNode {
  return { kind: "optional", nodes: [node], params: { parts: [] } }
}
