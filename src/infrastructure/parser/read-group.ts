import type { TemplateNode } from "../../domain/language/types"
import { readAlternation } from "./read-alternation"
import { readLine } from "./read-line"
import { readOptional } from "./read-optional"

export type ReadGroup = {
  node: TemplateNode
  next: number
}

export function readGroup(lines: string[], index: number, sourceLine: number): ReadGroup {
  return readOptional(lines, index, sourceLine) ?? readAlternation(lines, index, sourceLine) ?? readLine(lines[index] ?? "", index, sourceLine)
}
