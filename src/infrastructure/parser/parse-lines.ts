import type { TemplateNode } from "../../domain/language/types"
import { readGroup } from "./read-group"

export function parseLines(lines: string[]): TemplateNode[] {
  const nodes: TemplateNode[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const group = readGroup(lines, index)
    nodes.push(group.node)
    index = group.next - 1
  }

  return nodes
}
