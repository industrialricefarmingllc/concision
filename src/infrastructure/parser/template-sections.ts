export type TemplateSections = {
  metadata: string
  body: string
  bodyStartLine: number
}

export function templateSections(text: string): TemplateSections {
  const parts = text.split(/^---\s*$/m)
  const [, metadata = "", body = text] = parts

  if (parts.length < 3) {
    return { metadata, body, bodyStartLine: 1 }
  }

  const leadingNewline = body.startsWith("\n") ? 1 : 0
  const beforeBody = text.slice(0, text.length - body.length + leadingNewline)
  const bodyStartLine = (beforeBody.match(/\n/g)?.length ?? 0) + 1

  return { metadata, body, bodyStartLine }
}
