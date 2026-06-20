import type { LinePattern, PatternPart } from "../language/types"

export type LineMismatch = {
  expected: string
  problem: string
  fix: string
}

export function lineMatches(pattern: LinePattern, line: string): boolean {
  return textMatches(matchParts(pattern), line) && constraintsPass(pattern, line)
}

export function explainLineMismatch(pattern: LinePattern, line: string): LineMismatch {
  const expected = formatLinePattern(pattern)

  if (expected === "<blank line>") {
    return {
      expected,
      problem: "Blank line expected.",
      fix: "Please investigate why the format diverges from the specification, do not simply add a blank line.",
    }
  }

  for (const rule of pattern.constraints) {
    if (rule.kind === "exclude" && line.includes(rule.value)) {
      return {
        expected,
        problem: `The rule forbids text \`${rule.value}\`, but the line contains it.`,
        fix: `Remove \`${rule.value}\` from this line.`,
      }
    }

    if (rule.kind === "require" && !line.includes(rule.value)) {
      return {
        expected,
        problem: `The rule requires text \`${rule.value}\`, but the line is missing it.`,
        fix: `Add \`${rule.value}\` to this line.`,
      }
    }
  }

  return {
    expected,
    problem: "The rule does not match the source line.",
    fix: `Change the source line to match \`${expected}\`.`,
  }
}

export function formatLinePattern(pattern: LinePattern): string {
  const body = pattern.parts.map(formatPart).join("")
  const repeated = pattern.repeat ? `${body}**${pattern.repeat.max ?? ""}` : body
  return `${repeated}${pattern.constraints.map(formatConstraint).join("")}`.trim() || "<blank line>"
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

function formatPart(part: PatternPart): string {
  if (part.kind === "wildcard") return "*"
  return part.value.trim()
}

function formatConstraint(pattern: LinePattern["constraints"][number]): string {
  if (pattern.kind === "exclude") return `!${pattern.value}`
  return `!!${pattern.value}`
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
