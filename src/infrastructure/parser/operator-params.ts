import type { OperatorParams, ParamPart } from "../../domain/language/types"

export function parseOperatorParams(content: string): OperatorParams {
  const parts: ParamPart[] = []
  let buffer = ""
  let placeholder: { name: string; values: string[] } | null = null

  let index = 0
  while (index < content.length) {
    const char = content[index]

    if (char === "\\" && index + 1 < content.length) {
      const next = content[index + 1]
      if (placeholder) {
        placeholder.values.push(next)
      } else {
        buffer += next
      }
      index += 2
      continue
    }

    if (char === "$" && index + 1 < content.length && /[a-zA-Z_]/.test(content[index + 1] ?? "")) {
      if (buffer.length > 0) {
        parts.push({ kind: "literal", value: buffer })
        buffer = ""
      }
      let name = ""
      index += 1
      while (index < content.length && /[a-zA-Z0-9_]/.test(content[index] ?? "")) {
        name += content[index]
        index += 1
      }
      placeholder = { name, values: [] }
      continue
    }

    if (char === ";" && placeholder) {
      placeholder.values.push(buffer)
      buffer = ""
      index += 1
      continue
    }

    if (placeholder) {
      placeholder.values.push(char)
    } else {
      buffer += char
    }
    index += 1
  }

  if (placeholder) {
    if (buffer.length > 0) {
      placeholder.values.push(buffer)
      buffer = ""
    }
    parts.push({ kind: "placeholder", name: placeholder.name, values: placeholder.values })
  } else if (buffer.length > 0) {
    parts.push({ kind: "literal", value: buffer })
  }

  return { parts }
}

export function emptyOperatorParams(): OperatorParams {
  return { parts: [] }
}

export function findClosingBracket(content: string, start: number): number {
  let depth = 0
  let index = start
  while (index < content.length) {
    const char = content[index]
    if (char === "\\" && index + 1 < content.length) {
      index += 2
      continue
    }
    if (char === "[") depth += 1
    else if (char === "]") {
      depth -= 1
      if (depth === 0) return index
    }
    index += 1
  }
  return -1
}
