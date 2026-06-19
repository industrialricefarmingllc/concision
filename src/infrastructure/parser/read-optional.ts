import { parseLines } from "./parse-lines"
import type { ReadGroup } from "./read-group"
import { blockLines, closingLine } from "./block-lines"

export function readOptional(lines: string[], index: number): ReadGroup | null {
  const line = lines[index]?.trim() ?? ""
  if (!line.startsWith("~")) return null

  if (line.includes("**")) return { node: { kind: "optional", nodes: parseLines([line.slice(1)]) }, next: index + 1 }

  const close = closingLine(lines, index, "~")
  const body = close > index ? blockLines(lines, index, close, "~") : [line.slice(1)]

  return { node: { kind: "optional", nodes: parseLines(body) }, next: close > index ? close + 1 : index + 1 }
}
