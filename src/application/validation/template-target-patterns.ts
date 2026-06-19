import { parseTemplates } from "./parse-templates"
import type { ParseTemplate, TextFile } from "./types"

export function templateTargetPatterns(files: TextFile[], parseTemplate: ParseTemplate): string[] {
  return parseTemplates(files, parseTemplate).templates.flatMap((template) => template.paths)
}
