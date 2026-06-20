import type { TemplateDocument } from "../../domain/language/types"
import type { VariableCounter } from "../../domain/language/variable-counter"
import { matchTemplate } from "../../domain/matching/match-template"
import type { FileValidation, TextFile } from "./types"

export function validateOneFile(file: TextFile, templates: TemplateDocument[], variableCounter?: VariableCounter): FileValidation {
  if (templates.length === 0) return unmatched(file)

  const results = templates.map((template) => matchTemplate(template, { filePath: file.path, content: file.content, variableCounter }))
  const valid = results.every((result) => result.valid)

  return {
    path: file.path,
    valid,
    templates: templates.map((template) => template.path),
    errors: valid ? [] : results.flatMap((result) => result.errors),
    warnings: unique(results.flatMap((result) => result.warnings)),
  }
}

function unmatched(file: TextFile): FileValidation {
  return { path: file.path, valid: false, templates: [], errors: ["No template matched file"], warnings: [] }
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}
