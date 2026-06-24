import { generate } from "peggy"
import type { LinePattern, PatternPart, WildcardPart } from "../../domain/language/types"
import { lineGrammar } from "../../domain/language/line-grammar"

const parser = generate(lineGrammar)

export type LineParseError = Error & {
  sourceLine: number
  sourceText: string
  column: number
}

export function parseLinePattern(line: string, sourceLine: number): LinePattern {
  try {
    return normalizePattern(parser.parse(line) as LinePattern)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const column = extractColumn(error)
    const rich = new Error(message) as LineParseError
    rich.sourceLine = sourceLine
    rich.sourceText = line
    rich.column = column
    throw rich
  }
}

function normalizePattern(pattern: LinePattern): LinePattern {
  // When the entire line is **[content], expand the content into the line's parts.
  if (pattern.repeat?.content && pattern.parts.length === 0) {
    const inner = normalizePattern(parser.parse(pattern.repeat.content) as LinePattern)
    return expandBareRequire({
      ...inner,
      repeat: { max: pattern.repeat.max, index: inner.parts.length, content: null },
    })
  }

  return expandBareRequire({
    ...pattern,
    parts: normalizeParts(pattern.parts),
    repeat: pattern.repeat ? { ...pattern.repeat, content: pattern.repeat.content } : null,
  })
}

function normalizeParts(parts: PatternPart[]): PatternPart[] {
  return parts.map((part) => {
    if (part.kind === "optional") {
      const content = (part as { content: string }).content
      const inner = parser.parse(content) as LinePattern
      return { kind: "optional" as const, parts: normalizePattern(inner).parts, params: { parts: [] } }
    }
    return part
  })
}

function expandBareRequire(pattern: LinePattern): LinePattern {
  const wildcardIdx = pattern.parts.findIndex((p) => p.kind === "wildcard" && p.constraints.some((c) => c.kind === "requireRest"))
  if (wildcardIdx === -1) return pattern

  const wildcard = pattern.parts[wildcardIdx] as WildcardPart
  const restParts = pattern.parts.slice(wildcardIdx + 1)

  const requireValue = restParts.map((p) => {
    if (p.kind === "literal") return p.value
    if (p.kind === "capture") return `_${p.id}_`
    return "*"
  }).join("")

  wildcard.constraints = wildcard.constraints.map((c) => c.kind === "requireRest" ? { kind: "requireRest", value: requireValue } as const : c)
  pattern.parts = pattern.parts.slice(0, wildcardIdx + 1)

  return pattern
}

function extractColumn(error: unknown): number {
  if (!error || typeof error !== "object") return 0
  const location = (error as { location?: { start?: { column?: number } } }).location
  return location?.start?.column ?? 0
}
