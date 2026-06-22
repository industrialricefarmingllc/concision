import type { TemplateDocument } from "../../domain/language/types"
import type { TemplateError } from "../../infrastructure/parser/parse-template"
import type { ParseTemplate, TextFile } from "./types"

export type ParsedTemplates = {
  templates: TemplateDocument[]
  errors: TemplateError[]
}

export function parseTemplates(files: TextFile[], parseTemplate: ParseTemplate): ParsedTemplates {
  const parsed = files.map((file) => parseTemplate(file.content, file.path))

  return {
    templates: parsed.flatMap((result) => (result.ok ? [result.value] : [])),
    errors: parsed.flatMap((result) => (result.ok ? [] : result.errors)),
  }
}
