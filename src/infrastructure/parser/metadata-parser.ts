export function parsePaths(metadata: string): string[] {
  return metadata
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("paths:"))
    .flatMap(pathsFromLine)
}

function pathsFromLine(line: string): string[] {
  return line
    .slice("paths:".length)
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean)
}
