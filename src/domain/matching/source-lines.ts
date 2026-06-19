export function sourceLines(content: string): string[] {
  const trimmed = content.trim()

  if (trimmed.length === 0) return []

  return trimmed.split(/\r?\n/).map((line) => line.trim())
}
