import type { TemplateDocument } from "../../domain/language/types"
import type { VariableCounter } from "../../domain/language/variable-counter"
import type { Result } from "../../domain/shared/result"

export type TextFile = {
  path: string
  content: string
}

export type ParseTemplate = (text: string, path: string) => Result<TemplateDocument>

export type ValidationInput = {
  parseTemplate: ParseTemplate
  variableCounter?: VariableCounter
  templates: TextFile[]
  files: TextFile[]
}

export type ValidationReport = {
  valid: boolean
  files: FileValidation[]
  errors: string[]
  warnings: string[]
}

export type FileValidation = {
  path: string
  valid: boolean
  templates: string[]
  errors: string[]
  warnings: string[]
}
