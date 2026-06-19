import { parseLines } from "./parse-lines"
import type { ReadGroup } from "./read-group"
import { blockTail, closingLine } from "./block-lines"

export function readAlternation(lines: string[], index: number): ReadGroup | null {
  const split = splitAlternation(lines[index] ?? "")
  if (!split) return null

  const close = closingLine(lines, index, "|")
  const right = close > index ? blockTail(lines, index, close, split.right, "|") : [split.right]

  return { node: { kind: "alternation", choices: [parseLines([split.left]), parseLines(right)] }, next: close > index ? close + 1 : index + 1 }
}

function splitAlternation(line: string): { left: string; right: string } | null {
  const index = line.indexOf("|")
  if (index === -1) return null
  return { left: line.slice(0, index), right: line.slice(index + 1) }
}
