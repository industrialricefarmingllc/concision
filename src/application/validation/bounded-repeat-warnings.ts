import { hasBoundedRepeat } from "../../domain/language/has-bounded-repeat"
import type { TemplateDocument } from "../../domain/language/types"
import type { VariableCounter } from "../../domain/language/variable-counter"
import { pathMatches } from "./path-matches"
import type { TextFile } from "./types"

export function boundedRepeatWarnings(files: TextFile[], templates: TemplateDocument[], variableCounter?: VariableCounter): string[] {
  const warnedExtensions = new Set<string>()

  for (const file of files) {
    if (!templatesForFile(file.path, templates).some((template) => hasBoundedRepeat(template.nodes))) continue
    if (variableCounter?.({ filePath: file.path, content: "" }).supported) continue

    warnedExtensions.add(extensionLabel(file.path))
  }

  return [...warnedExtensions].map((extension) => `A template specified variable counting, but none was supported for the ${extension} file extension.`)
}

function templatesForFile(filePath: string, templates: TemplateDocument[]): TemplateDocument[] {
  return templates.filter((template) => {
    if (template.exclude.some((glob) => pathMatches(filePath, glob))) return false
    return template.paths.some((glob) => pathMatches(filePath, glob))
  })
}

function extensionLabel(filePath: string): string {
  const match = /\.[^.\/]+$/.exec(filePath)
  return match?.[0] ?? "<no>"
}
