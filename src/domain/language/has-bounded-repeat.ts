import type { TemplateNode } from "./types"

export function hasBoundedRepeat(nodes: TemplateNode[]): boolean {
  return nodes.some(hasBoundedRepeatNode)
}

function hasBoundedRepeatNode(node: TemplateNode): boolean {
  if (node.kind === "line") return node.pattern.repeat?.max !== null && node.pattern.repeat?.max !== undefined
  if (node.kind === "optional") return hasBoundedRepeat(node.nodes)
  return node.choices.some(hasBoundedRepeat)
}
