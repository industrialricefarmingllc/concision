import { generate } from "peggy"
import type { LinePattern } from "../../domain/language/types"
import { lineGrammar } from "../../domain/language/line-grammar"

const parser = generate(lineGrammar)

export function parseLinePattern(line: string): LinePattern {
  return parser.parse(line.trim()) as LinePattern
}
