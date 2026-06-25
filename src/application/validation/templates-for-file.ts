import type { TemplateDocument } from "../../domain/language/types"
import { pathMatches } from "./path-matches"

export function templatesForFile(filePath: string, templates: TemplateDocument[]): TemplateDocument[] {
  return templates.filter((template) => {
    if (template.exclude.some((glob) => pathMatches(filePath, glob))) return false
    return template.paths.some((glob) => pathMatches(filePath, glob))
  })
}
