import { parseTemplates } from "./parse-templates"
import { templatesForFile } from "./templates-for-file"
import type { ValidationInput, ValidationReport } from "./types"
import { validateOneFile } from "./validate-one-file"

export function validateFiles(input: ValidationInput): ValidationReport {
  const parsed = parseTemplates(input.templates, input.parseTemplate)
  const files = input.files.map((file) => validateOneFile(file, templatesForFile(file.path, parsed.templates), input.variableCounter))

  return {
    valid: parsed.errors.length === 0 && files.every((file) => file.valid),
    files,
    errors: parsed.errors,
    warnings: files.flatMap((file) => file.warnings),
  }
}
