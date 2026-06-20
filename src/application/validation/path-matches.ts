export function pathMatches(path: string, glob: string): boolean {
  const pathSegments = segments(path)
  const globSegments = segments(glob)
  if (excludedByNegativeGlobstarSegment(pathSegments, globSegments)) return false
  return matchSegments(pathSegments, globSegments)
}

function matchSegments(path: string[], glob: string[]): boolean {
  if (glob.length === 0) return path.length === 0
  if (glob[0] === "**") return matchGlobstar(path, glob)
  if (path.length === 0) return false
  return segmentMatches(path[0] ?? "", glob[0] ?? "") && matchSegments(path.slice(1), glob.slice(1))
}

function matchGlobstar(path: string[], glob: string[]): boolean {
  return matchSegments(path, glob.slice(1)) || (path.length > 0 && matchSegments(path.slice(1), glob))
}

function segmentMatches(path: string, glob: string): boolean {
  const negative = negativeSegmentPatterns(glob)
  if (negative) return !negative.some((pattern) => segmentMatches(path, pattern))

  return new RegExp(`^${glob.split("*").map(escapeRegex).join(".*")}$`).test(path)
}

function excludedByNegativeGlobstarSegment(path: string[], glob: string[]): boolean {
  return glob.some((segment, index) => {
    const negative = negativeSegmentPatterns(segment)
    if (!negative || (glob[index - 1] !== "**" && glob[index + 1] !== "**")) return false
    return path.some((pathSegment) => negative.some((pattern) => segmentMatches(pathSegment, pattern)))
  })
}

function negativeSegmentPatterns(glob: string): string[] | null {
  const match = /^!\((.+)\)$/.exec(glob)
  return match?.[1] ? match[1].split("|") : null
}

function segments(path: string): string[] {
  return path.split("/").filter(Boolean)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
