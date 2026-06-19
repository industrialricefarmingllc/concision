import type { LinePattern, PatternPart } from "../language/types"

export function lineMatches(pattern: LinePattern, line: string): boolean {
  return textMatches(matchParts(pattern), line) && constraintsPass(pattern, line)
}

function matchParts(pattern: LinePattern): PatternPart[] {
  if (!pattern.repeat) return pattern.parts
  return [...pattern.parts, { kind: "wildcard" }]
}

function textMatches(parts: PatternPart[], line: string): boolean {
  return patternRegex(parts).test(line)
}

function constraintsPass(pattern: LinePattern, line: string): boolean {
  return pattern.constraints.every((rule) => {
    if (rule.kind === "exclude") return !line.includes(rule.value)
    return line.includes(rule.value)
  })
}

function patternRegex(parts: PatternPart[]): RegExp {
  return new RegExp(`^${parts.map(regexPart).join("")}$`)
}

function regexPart(part: PatternPart): string {
  if (part.kind === "wildcard") return ".*"
  return escapeRegex(part.value.trim())
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
