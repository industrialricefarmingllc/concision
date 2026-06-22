import { parseLines } from "./parse-lines"
import type { ReadGroup } from "./read-group"
import { emptyOperatorParams, parseOperatorParams } from "./operator-params"
import { extractBracketContent, findMatchingBracket } from "./block-lines"

export function readOptional(lines: string[], index: number, sourceLine: number): ReadGroup | null {
  const line = lines[index]?.trim() ?? ""
  if (!line.startsWith("~")) return null

  if (line === "~") {
    return { node: { kind: "optional", nodes: [], params: emptyOperatorParams() }, next: index + 1 }
  }

  if (line.startsWith("~[")) {
    return readBracketOptional(lines, index, line, sourceLine)
  }

  return null
}

function readBracketOptional(lines: string[], index: number, startLine: string, sourceLine: number): ReadGroup {
  if (startLine.endsWith("]") && countUnescapedBrackets(startLine) === 0) {
    const content = startLine.slice(2, -1)
    const { body, params } = splitBodyAndParams(content)
    return { node: { kind: "optional", nodes: parseLines([body], sourceLine), params }, next: index + 1 }
  }

  const close = findMatchingBracket(lines, index)
  const content = extractBracketContent(lines, index, close)
  const inner = stripOuterBrackets(content)
  const { body, params } = splitBodyAndParams(inner)
  const bodyLines = body.trim() === "" ? [] : body.split("\n")
  const innerLineOffset = sourceLine + 1 - (body.match(/^\n*/)?.[0].length ?? 0)
  return { node: { kind: "optional", nodes: parseLines(bodyLines, innerLineOffset), params }, next: close + 1 }
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

function splitBodyAndParams(content: string): { body: string; params: ReturnType<typeof parseOperatorParams> } {
  const lines = content.split("\n")
  if (lines.length === 0) return { body: content, params: emptyOperatorParams() }

  const lastLine = lines[lines.length - 1] ?? ""
  if (lastLine.startsWith(":")) {
    const paramsContent = lines.slice(0, -1).join("\n") + "\n" + lastLine.slice(1)
    return { body: lines.slice(0, -1).join("\n"), params: parseOperatorParams(paramsContent) }
  }

  return { body: content, params: emptyOperatorParams() }
}
