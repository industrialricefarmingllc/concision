import { parseLines } from "./parse-lines"
import type { ReadGroup } from "./read-group"
import { emptyOperatorParams } from "./operator-params"
import { extractBracketContent, findMatchingBracket } from "./block-lines"

export function readAlternation(lines: string[], index: number, sourceLine: number): ReadGroup | null {
  const line = lines[index]?.trim() ?? ""
  if (!line.startsWith("|[")) return null

  let content: string
  let next: number

  if (line.endsWith("]") && countUnescapedBrackets(line) === 0) {
    content = line.slice(2, -1)
    next = index + 1
  } else {
    const close = findMatchingBracket(lines, index)
    if (close < 0) return null
    const raw = extractBracketContent(lines, index, close)
    content = stripOuterBrackets(raw)
    next = close + 1
  }

  return buildAlternation(content, index, next, sourceLine)
}

function buildAlternation(content: string, index: number, next: number, lineOffset: number): ReadGroup {
  const options = splitOptions(content)
  let currentLine = lineOffset + 1
  const choices = options.map((option) => {
    const trimmed = option.trim()
    if (trimmed === "") return []
    const optionLines = trimmed.split("\n")
    const result = parseLines(optionLines, currentLine)
    currentLine += optionLines.length + 1
    return result
  })
  return { node: { kind: "alternation", choices, params: emptyOperatorParams() }, next }
}

function stripOuterBrackets(content: string): string {
  let depth = 0
  let start = -1
  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]
    if (char === "\\" && i + 1 < content.length) {
      i += 1
      continue
    }
    if (char === "[") {
      if (start === -1) start = i + 1
      depth += 1
      continue
    }
    if (char === "]") {
      depth -= 1
      if (depth === 0) return content.slice(start ?? 0, i)
    }
  }
  return content
}

function splitOptions(content: string): string[] {
  const options: string[] = []
  let current = ""
  let depth = 0
  let parenDepth = 0

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]
    if (char === "\\" && i + 1 < content.length) {
      current += char + (content[i + 1] ?? "")
      i += 1
      continue
    }
    if (char === "[") depth += 1
    else if (char === "]") depth -= 1
    else if (char === "(") parenDepth += 1
    else if (char === ")") parenDepth -= 1
    if (char === "<" && content[i + 1] === ">" && depth === 0 && parenDepth === 0) {
      options.push(current.trim())
      current = ""
      i += 1
      continue
    }
    current += char ?? ""
  }
  options.push(current)
  return options
}

function countUnescapedBrackets(line: string): number {
  let depth = 0
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === "\\" && i + 1 < line.length) {
      i += 1
      continue
    }
    if (char === "[") depth += 1
    else if (char === "]") depth -= 1
  }
  return depth
}
