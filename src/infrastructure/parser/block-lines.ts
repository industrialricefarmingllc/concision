export function closingLine(lines: string[], start: number, marker: string): number {
  return lines.findIndex((line, index) => index > start && line.trim().endsWith(marker))
}

export function blockLines(lines: string[], start: number, close: number, marker: string): string[] {
  return [lines[start]?.trim().slice(1) ?? "", ...middleLines(lines, start, close), closingText(lines, close, marker)]
}

export function blockTail(lines: string[], start: number, close: number, first: string, marker: string): string[] {
  return [first, ...middleLines(lines, start, close), closingText(lines, close, marker)]
}

function middleLines(lines: string[], start: number, close: number): string[] {
  return lines.slice(start + 1, close)
}

function closingText(lines: string[], close: number, marker: string): string {
  return (lines[close] ?? "").trim().slice(0, -marker.length)
}
