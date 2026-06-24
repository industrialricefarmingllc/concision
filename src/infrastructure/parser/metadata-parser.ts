export function parsePaths(metadata: string): string[] {
  return metadata
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("paths:"))
    .flatMap(pathsFromLine)
}

export function parseExclude(metadata: string): string[] {
  return metadata
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("exclude:"))
    .flatMap(excludeFromLine)
}

function excludeFromLine(line: string): string[] {
  return line
    .slice("exclude:".length)
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean)
}

function pathsFromLine(line: string): string[] {
  return line
    .slice("paths:".length)
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean)
}
