import type { Constraint, LinePattern, PatternPart } from "../language/types"

export type Captures = Record<string, string>

export type LinePatternMatch = {
  captures: Captures
}

export type InlineRepeatMatch = {
  end: number
  captures: Captures
}

export type LineMismatch = {
  expected: string
  problem: string
  fix: string
  span: number
  highlightOffset: number
}

export function lineMatches(pattern: LinePattern, line: string): boolean {
  return matchLinePattern(pattern, line, {}).length > 0
}

export function matchLinePattern(pattern: LinePattern, line: string, captures: Captures): LinePatternMatch[] {
  if (hasScopedWildcardConstraints(pattern)) return matchScopedWildcardPattern(pattern, line, captures)
  if (!constraintsPass(pattern, line)) return []
  if (pattern.parts.length === 0 && pattern.constraints.length > 0) return [{ captures }]
  return matchText(matchParts(pattern), line, captures).map((captures) => ({ captures }))
}

export function lineStructureMatches(pattern: LinePattern, line: string, captures: Captures): boolean {
  if (pattern.parts.length === 0 && pattern.constraints.length > 0) return true
  return matchText(matchParts(pattern), line, captures, { wildcardConstraints: false }).length > 0
}

export function inlineRepeatEndings(pattern: LinePattern, lines: string[], position: number, captures: Captures): InlineRepeatMatch[] {
  const endings: InlineRepeatMatch[] = []

  for (let end = position; end <= lines.length; end += 1) {
    const content = lines.slice(position, end).join("\n")
    if (!constraintsPass(pattern, content)) continue
    for (const nextCaptures of matchInlineRepeat(pattern, content, captures)) endings.push({ end, captures: nextCaptures })
  }

  return endings
}

export function hasInlineRepeat(pattern: LinePattern): boolean {
  return pattern.repeat !== null && pattern.repeat.index < pattern.parts.length
}

export function explainLineMismatch(pattern: LinePattern, lines: string[], position: number, captures: Captures = {}): LineMismatch {
  const expected = formatLinePattern(pattern)
  const line = lines[position] ?? ""

  if (expected === "<blank line>") {
    return {
      expected,
      problem: "Blank line expected.",
      fix: "Please investigate why the format diverges from the specification, do not simply add a blank line.",
      span: 1,
      highlightOffset: 0,
    }
  }

  const scopedWildcard = scopedWildcardMismatch(pattern, line, captures)
  if (scopedWildcard) return scopedWildcard

  const wildcardConstraint = wildcardConstraintMismatch(pattern, lines, position, captures)
  if (wildcardConstraint) return wildcardConstraint

  const constrainedSpan = constraintMismatch(pattern, lines, position, captures)
  if (constrainedSpan) return constrainedSpan

  const capturedSpan = captureMismatch(pattern, lines, position, captures)
  if (capturedSpan) return capturedSpan

  for (const rule of pattern.constraints) {
    if (rule.kind === "exclude" && constraintMatches(rule.value, line)) {
      return {
        expected,
        problem: `The rule forbids text \`${rule.value}\`, but the line contains it.`,
        fix: `Remove \`${rule.value}\` from this line.`,
        span: 1,
        highlightOffset: 0,
      }
    }

    if (rule.kind === "require" && !constraintMatches(rule.value, line)) {
      return {
        expected,
        problem: `The rule requires text \`${rule.value}\`, but the line is missing it.`,
        fix: `Add \`${rule.value}\` to this line.`,
        span: 1,
        highlightOffset: 0,
      }
    }
  }

  return {
    expected,
    problem: "The rule does not match the source line.",
    fix: `Change the source line to match \`${expected}\`.`,
    span: 1,
    highlightOffset: 0,
  }
}

export function formatLinePattern(pattern: LinePattern): string {
  return `${formatParts(pattern)}${pattern.constraints.map(formatConstraint).join("")}`.trim() || "<blank line>"
}

function matchParts(pattern: LinePattern): PatternPart[] {
  if (!pattern.repeat) return pattern.parts
  return [...pattern.parts.slice(0, pattern.repeat.index), { kind: "wildcard", constraints: [] }, ...pattern.parts.slice(pattern.repeat.index)]
}

function matchInlineRepeat(pattern: LinePattern, content: string, captures: Captures): Captures[] {
  if (!pattern.repeat) return []

  const before = pattern.parts.slice(0, pattern.repeat.index)
  const after = pattern.parts.slice(pattern.repeat.index)
  return matchText([...before, { kind: "multilineWildcard" }, ...after], content, captures)
}

function matchScopedWildcardPattern(pattern: LinePattern, line: string, captures: Captures): LinePatternMatch[] {
  return matchTextWithScopedWildcard(pattern.parts, line, captures)
    .filter((match) => lineConstraintMismatch(pattern, match) === null)
    .map((match) => ({ captures: match.captures }))
}

function scopedWildcardMismatch(pattern: LinePattern, line: string, captures: Captures): LineMismatch | null {
  if (!hasScopedWildcardConstraints(pattern)) return null

  const matches = matchTextWithScopedWildcard(pattern.parts, line, captures)
  const match = matches[0]
  if (!match) return null

  for (const checked of match.wildcards) {
    for (const rule of checked.constraints) {
      if (rule.kind === "exclude" && constraintMatches(rule.value, checked.value)) {
        return {
          expected: formatLinePattern(pattern),
          problem: `The wildcard forbids text \`${rule.value}\`, but its matched content is \`${checked.value}\`.`,
          fix: `Ensure \`${rule.value}\` is not used here.`,
          span: 1,
          highlightOffset: 0,
        }
      }

      if (rule.kind === "require" && !constraintMatches(rule.value, checked.value)) {
        return {
          expected: formatLinePattern(pattern),
          problem: `The wildcard requires text \`${rule.value}\`, but its matched content is \`${checked.value}\`.`,
          fix: `Change the wildcard content so it includes \`${rule.value}\`.`,
          span: 1,
          highlightOffset: 0,
        }
      }

      if (rule.kind === "requireRest" && !wildcardConstraintsPass([rule], checked.value)) {
        return {
          expected: formatLinePattern(pattern),
          problem: `The wildcard requires text \`${rule.value}\`, but its matched content is \`${checked.value}\`.`,
          fix: `Change the wildcard content so it includes \`${rule.value}\`.`,
          span: 1,
          highlightOffset: 0,
        }
      }
    }
  }

  return lineConstraintMismatch(pattern, match)
}

function wildcardConstraintMismatch(pattern: LinePattern, lines: string[], position: number, captures: Captures): LineMismatch | null {
  if (!hasDirectWildcardConstraints(pattern.parts)) return null

  const matches = matchTextWithScopedWildcard(matchParts(pattern), lines[position] ?? "", captures, { includeLineConstraints: false })
  const match = matches[0]
  if (!match) return null

  for (const checked of match.wildcards) {
    for (const rule of checked.constraints) {
      if (rule.kind === "exclude" && constraintMatches(rule.value, checked.value)) {
        return {
          expected: formatLinePattern(pattern),
          problem: `The wildcard forbids text \`${rule.value}\`, but its matched content is \`${checked.value}\`.`,
          fix: `Ensure \`${rule.value}\` is not used here.`,
          span: 1,
          highlightOffset: 0,
        }
      }

      if (rule.kind === "require" && !constraintMatches(rule.value, checked.value)) {
        return {
          expected: formatLinePattern(pattern),
          problem: `The wildcard requires text \`${rule.value}\`, but its matched content is \`${checked.value}\`.`,
          fix: `Change the wildcard content so it includes \`${rule.value}\`.`,
          span: 1,
          highlightOffset: 0,
        }
      }

      if (rule.kind === "requireRest" && !wildcardConstraintsPass([rule], checked.value)) {
        return {
          expected: formatLinePattern(pattern),
          problem: `The wildcard requires text \`${rule.value}\`, but its matched content is \`${checked.value}\`.`,
          fix: `Change the wildcard content so it includes \`${rule.value}\`.`,
          span: 1,
          highlightOffset: 0,
        }
      }
    }
  }

  return null
}

function lineConstraintMismatch(pattern: LinePattern, match: ScopedWildcardMatch): LineMismatch | null {
  for (const rule of pattern.constraints) {
    const wildcard = match.wildcards[0]?.value ?? ""
    if (rule.kind === "exclude" && constraintMatches(rule.value, wildcard)) {
      return {
        expected: formatLinePattern(pattern),
        problem: `The wildcard forbids text \`${rule.value}\`, but its matched content is \`${wildcard}\`.`,
        fix: `Ensure \`${rule.value}\` is not used here.`,
        span: 1,
        highlightOffset: 0,
      }
    }

    if (rule.kind === "require" && !constraintMatches(rule.value, wildcard)) {
      return {
        expected: formatLinePattern(pattern),
        problem: `The wildcard requires text \`${rule.value}\`, but its matched content is \`${wildcard}\`.`,
        fix: `Change the wildcard content so it includes \`${rule.value}\`.`,
        span: 1,
        highlightOffset: 0,
      }
    }
  }

  return null
}

function hasScopedWildcardConstraints(pattern: LinePattern): boolean {
  return pattern.repeat === null && pattern.constraints.length > 0 && pattern.parts.filter((part) => part.kind === "wildcard").length === 1
}

function hasDirectWildcardConstraints(parts: PatternPart[]): boolean {
  return parts.some((part) => part.kind === "wildcard" && part.constraints.length > 0)
}

type ScopedWildcardMatch = {
  captures: Captures
  wildcards: Array<{ value: string; constraints: Constraint[] }>
}

function matchTextWithScopedWildcard(parts: PatternPart[], text: string, captures: Captures, options: { includeLineConstraints?: boolean } = {}): ScopedWildcardMatch[] {
  const groups: Array<{ kind: "capture"; id: string } | { kind: "wildcard"; constraints: Constraint[] }> = []
  const source = parts.map((part) => scopedWildcardRegexPart(part, captures, groups)).join("")
  const match = new RegExp(`^${source}$`).exec(text)
  if (!match) return []

  const nextCaptures = { ...captures }
  const wildcards: Array<{ value: string; constraints: Constraint[] }> = []
  let group = 1

  for (const item of groups) {
    const value = match[group]
    group += 1
    if (value === undefined) return []

    if (item.kind === "wildcard") {
      wildcards.push({ value: value.trim(), constraints: options.includeLineConstraints === false ? item.constraints : item.constraints })
      continue
    }

    const captured = nextCaptures[item.id]
    if (captured !== undefined && !capturesMatch(captured, value)) return []
    nextCaptures[item.id] = captured ?? value
  }

  return [{ captures: nextCaptures, wildcards }]
}

function scopedWildcardRegexPart(part: PatternPart, captures: Captures, groups: Array<{ kind: "capture"; id: string } | { kind: "wildcard"; constraints: Constraint[] }>): string {
  if (part.kind === "wildcard") {
    groups.push({ kind: "wildcard", constraints: part.constraints })
    return "(.*?)"
  }

  if (part.kind === "capture") {
    const key = String(part.id)
    const captured = captures[key]
    if (captured !== undefined) return `\\s*${caseVariantRegex(captured)}\\s*`

    groups.push({ kind: "capture", id: key })
    return "\\s*(.+?)\\s*"
  }

  return escapeRegex(part.value.trim())
}

function constraintMismatch(pattern: LinePattern, lines: string[], position: number, captures: Captures): LineMismatch | null {
  if (hasScopedWildcardConstraints(pattern)) return null
  if (pattern.constraints.length === 0) return null

  for (const candidate of textMatchingCandidates(pattern, lines, position, captures)) {
    for (const rule of pattern.constraints) {
      if (rule.kind === "exclude" && constraintMatches(rule.value, candidate.content)) {
        return {
          expected: formatLinePattern(pattern),
          problem: `The rule forbids text \`${rule.value}\`, but the matched block contains it.`,
          fix: `Remove \`${rule.value}\` from this matched block.`,
          span: candidate.span,
          highlightOffset: offsetContaining(lines, position, candidate.span, rule.value),
        }
      }

      if (rule.kind === "require" && !constraintMatches(rule.value, candidate.content)) {
        return {
          expected: formatLinePattern(pattern),
          problem: `The rule requires text \`${rule.value}\`, but the matched block is missing it.`,
          fix: `Add \`${rule.value}\` to this matched block.`,
          span: candidate.span,
          highlightOffset: 0,
        }
      }
    }
  }

  return null
}

function captureMismatch(pattern: LinePattern, lines: string[], position: number, captures: Captures): LineMismatch | null {
  if (!hasCapture(pattern.parts)) return null

  if (hasInlineRepeat(pattern)) {
    for (let end = position + 1; end <= lines.length; end += 1) {
      const content = lines.slice(position, end).join("\n")
      const parts = inlineRepeatParts(pattern)
      const mismatch = findCaptureMismatch(parts, content, captures)
      if (!mismatch) continue

      return captureMismatchResult(pattern, mismatch, end - position, offsetContaining(lines, position, end - position, mismatch.actual))
    }

    return null
  }

  const mismatch = findCaptureMismatch(matchParts(pattern), lines[position] ?? "", captures)
  return mismatch ? captureMismatchResult(pattern, mismatch, 1, 0) : null
}

function captureMismatchResult(pattern: LinePattern, mismatch: CaptureMismatch, span: number, highlightOffset: number): LineMismatch {
  return {
    expected: formatLinePattern(pattern),
    problem: `The rule reuses \`_${mismatch.id}_\`, captured as \`${mismatch.expected}\`, but this line uses \`${mismatch.actual}\`.`,
    fix: `Replace \`${mismatch.actual}\` with \`${mismatch.expected}\` or a kebab/snake/camel/Pascal-case equivalent.`,
    span,
    highlightOffset,
  }
}

type CaptureMismatch = {
  id: string
  expected: string
  actual: string
}

function findCaptureMismatch(parts: RegexPart[], text: string, captures: Captures): CaptureMismatch | null {
  const regex = captureProbeRegex(parts)
  const match = regex.value.exec(text)
  if (!match) return null

  const nextCaptures = { ...captures }
  let group = 1

  for (const id of regex.captureIds) {
    const value = match[group]
    group += 1
    if (value === undefined) return null

    const captured = nextCaptures[id]
    if (captured !== undefined && !capturesMatch(captured, value)) return { id, expected: captured, actual: value }
    nextCaptures[id] = captured ?? value
  }

  return null
}

function captureProbeRegex(parts: RegexPart[]): { value: RegExp; captureIds: string[] } {
  const captureIds: string[] = []
  const source = parts.map((part) => captureProbeRegexPart(part, captureIds)).join("")
  return { value: new RegExp(`^${source}$`), captureIds }
}

function captureProbeRegexPart(part: RegexPart, captureIds: string[]): string {
  if (part.kind === "multilineWildcard") return "[\\s\\S]*"
  if (part.kind === "wildcard") return part.constraints.length > 0 ? ".*?" : ".*"
  if (part.kind === "capture") {
    captureIds.push(String(part.id))
    return "\\s*(.+?)\\s*"
  }

  return escapeRegex(part.value.trim())
}

function hasCapture(parts: PatternPart[]): boolean {
  return parts.some((part) => part.kind === "capture")
}

function inlineRepeatParts(pattern: LinePattern): RegexPart[] {
  if (!pattern.repeat) return pattern.parts
  return [...pattern.parts.slice(0, pattern.repeat.index), { kind: "multilineWildcard" }, ...pattern.parts.slice(pattern.repeat.index)]
}

function textMatchingCandidates(pattern: LinePattern, lines: string[], position: number, captures: Captures): Array<{ content: string; span: number }> {
  if (hasInlineRepeat(pattern)) {
    const candidates = []

    for (let end = position + 1; end <= lines.length; end += 1) {
      const content = lines.slice(position, end).join("\n")
      if (matchInlineRepeat(pattern, content, captures).length > 0) candidates.push({ content, span: end - position })
    }

    return candidates
  }

  const content = lines[position] ?? ""

  // Constraint-only patterns (no parts) apply to the whole line regardless of structure.
  if (pattern.parts.length === 0 && pattern.constraints.length > 0) return [{ content, span: 1 }]

  if (matchText(matchParts(pattern), content, captures).length === 0) return []
  return [{ content, span: 1 }]
}

function offsetContaining(lines: string[], position: number, span: number, value: string): number {
  for (let offset = 0; offset < span; offset += 1) {
    if (constraintMatches(value, lines[position + offset] ?? "")) return offset
  }

  return 0
}

function matchText(parts: RegexPart[], text: string, captures: Captures, options: { wildcardConstraints?: boolean } = {}): Captures[] {
  const regex = patternRegex(parts, captures, options)
  const match = regex.value.exec(text)
  if (!match) return []

  const nextCaptures = { ...captures }
  let group = 1

  for (const item of regex.groups) {
    const value = match[group]
    group += 1
    if (value === undefined) return []

    if (item.kind === "wildcard") {
      if (!wildcardConstraintsPass(item.constraints, value.trim())) return []
      continue
    }

    const captured = nextCaptures[item.id]
    if (captured !== undefined && !capturesMatch(captured, value)) return []
    nextCaptures[item.id] = captured ?? value
  }

  return [nextCaptures]
}

function constraintsPass(pattern: LinePattern, line: string): boolean {
  return pattern.constraints.every((rule) => {
    if (rule.kind === "exclude") return !constraintMatches(rule.value, line)
    if (rule.kind === "requireRest") return true
    return constraintMatches(rule.value, line)
  })
}

// ponytail: wildcard-specific constraint check that skips require when matched content is empty
// and uses suffix heuristic for requireRest (bare !!).
function wildcardConstraintsPass(constraints: Constraint[], value: string): boolean {
  return constraints.every((rule) => {
    if (rule.kind === "exclude") return !constraintMatches(rule.value, value)
    if (rule.kind === "require") {
      if (value === "") return true
      return constraintMatches(rule.value, value)
    }
    if (rule.kind === "requireRest") {
      if (value === "") return true
      if (constraintMatches(rule.value, value)) return true
      // ponytail: wildcard matched only delimiter chars from the require value — treat as empty
      if (rule.value.endsWith(value)) return true
      return false
    }
    return true
  })
}

type RegexPart = PatternPart | { kind: "multilineWildcard" }
type RegexGroup = { kind: "capture"; id: string } | { kind: "wildcard"; constraints: Constraint[] }

function patternRegex(parts: RegexPart[], captures: Captures, options: { wildcardConstraints?: boolean } = {}): { value: RegExp; groups: RegexGroup[] } {
  const groups: RegexGroup[] = []
  const source = parts.map((part) => regexPart(part, captures, groups, options)).join("")
  return { value: new RegExp(`^${source}$`), groups }
}

function regexPart(part: RegexPart, captures: Captures, groups: RegexGroup[], options: { wildcardConstraints?: boolean }): string {
  if (part.kind === "multilineWildcard") return "[\\s\\S]*"
  if (part.kind === "wildcard") {
    if (options.wildcardConstraints === false || part.constraints.length === 0) return ".*"
    groups.push({ kind: "wildcard", constraints: part.constraints })
    return "(.*?)"
  }
  if (part.kind === "capture") return captureRegex(part.id, captures, groups)
  return escapeRegex(part.value.trim())
}

function captureRegex(id: number, captures: Captures, groups: RegexGroup[]): string {
  const key = String(id)
  const captured = captures[key]
  if (captured !== undefined) return `\\s*${caseVariantRegex(captured)}\\s*`

  groups.push({ kind: "capture", id: key })
  return "\\s*(.+?)\\s*"
}

function formatPart(part: PatternPart): string {
  if (part.kind === "wildcard") return `*${part.constraints.map(formatConstraint).join("")}`
  if (part.kind === "capture") return `_${part.id}_`
  return part.value.trim()
}

function formatParts(pattern: LinePattern): string {
  if (!pattern.repeat) return pattern.parts.map(formatPartPreservingWhitespace).join("")

  const before = pattern.parts.slice(0, pattern.repeat.index).map(formatPart).join("")
  const after = pattern.parts.slice(pattern.repeat.index).map(formatPart).join("")
  const repeatSyntax = pattern.repeat.max !== null ? `**[${pattern.repeat.max}]` : "**"
  return `${before}${repeatSyntax}${after}`
}

function formatPartPreservingWhitespace(part: PatternPart): string {
  if (part.kind === "wildcard") return `*${part.constraints.map(formatConstraint).join("")}`
  if (part.kind === "capture") return `_${part.id}_`
  return part.value
}

function formatConstraint(pattern: LinePattern["constraints"][number]): string {
  if (pattern.kind === "exclude") return pattern.value === "*" ? "!" : `![${pattern.value}]`
  if (pattern.kind === "requireRest") return `!!${pattern.value}`
  return pattern.value === "*" ? "!!" : `!![${pattern.value}]`
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function constraintMatches(pattern: string, value: string): boolean {
  if (!pattern.includes("*")) return value.includes(pattern)
  return new RegExp(escapeRegex(pattern).replace(/\\\*/g, "[\\s\\S]*")).test(value)
}

function capturesMatch(expected: string, actual: string): boolean {
  return expected === actual || normalizedWords(expected) === normalizedWords(actual)
}

function caseVariantRegex(value: string): string {
  return `(?:${caseVariants(value).map(escapeRegex).join("|")})`
}

function caseVariants(value: string): string[] {
  const words = wordsIn(value)
  if (words.length === 0) return [value]

  const lower = words.map((word) => word.toLowerCase())
  return unique([value, lower.join("-"), lower.join("_"), lower.map(capitalize).join(""), [lower[0], ...lower.slice(1).map(capitalize)].join("")])
}

function normalizedWords(value: string): string {
  return wordsIn(value)
    .map((word) => word.toLowerCase())
    .join(" ")
}

function wordsIn(value: string): string[] {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean)
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}
