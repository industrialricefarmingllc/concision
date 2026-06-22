export function findMatchingBracket(lines: string[], start: number): number {
  let depth = 0
  let content = ""

  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
      const char = line[charIndex]
      if (char === "\\" && charIndex + 1 < line.length) {
        content += line[charIndex + 1] ?? ""
        charIndex += 1
        continue
      }
      if (char === "[") {
        depth += 1
        content += char
        continue
      }
      if (char === "]") {
        depth -= 1
        if (depth === 0) {
          return index
        }
        content += char
        continue
      }
      content += char ?? ""
    }
    content += "\n"
  }

  return -1
}

export function extractBracketContent(lines: string[], start: number, end: number): string {
  let content = ""
  for (let index = start; index <= end; index += 1) {
    const line = lines[index] ?? ""
    content += line
    if (index < end) content += "\n"
  }
  return content
}

export function findMatchingAngleBracket(lines: string[], start: number): number {
  let depth = 0

  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
      const char = line[charIndex]
      if (char === "\\" && charIndex + 1 < line.length) {
        charIndex += 1
        continue
      }
      if (char === "<") {
        depth += 1
        continue
      }
      if (char === ">") {
        depth -= 1
        if (depth === 0) return index
      }
    }
  }

  return -1
}

export function extractAngleBracketContent(lines: string[], start: number, end: number): string {
  let content = ""
  for (let index = start; index <= end; index += 1) {
    const line = lines[index] ?? ""
    if (index === start) {
      const openIdx = line.indexOf("<")
      content += openIdx >= 0 ? line.slice(openIdx + 1) : line
    } else if (index === end) {
      const closeIdx = line.lastIndexOf(">")
      content += line.slice(0, closeIdx >= 0 ? closeIdx : line.length)
    } else {
      content += line
    }
    if (index < end) content += "\n"
  }
  return content
}
