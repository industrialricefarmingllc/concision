export type TemplateSections = {
  metadata: string
  body: string
}

export function templateSections(text: string): TemplateSections {
  const [, metadata = "", body = text] = text.split(/^---\s*$/m)

  return { metadata, body }
}
