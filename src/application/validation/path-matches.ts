export function pathMatches(path: string, glob: string): boolean {
  return matchSegments(segments(path), segments(glob))
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
  return new RegExp(`^${glob.split("*").map(escapeRegex).join(".*")}$`).test(path)
}

function segments(path: string): string[] {
  return path.split("/").filter(Boolean)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
