import type { ReadGroup } from "./read-group"
import { parseLinePattern } from "./line-parser"

export function readLine(line: string, next: number, sourceLine: number): ReadGroup {
  return { node: { kind: "line", pattern: parseLinePattern(line.trim(), sourceLine) }, next: next + 1 }
}
