import type { TemplateDocument } from "../../domain/language/types"
import { failure, success, type Result } from "../../domain/shared/result"
import { parseBody } from "./body-parser"
import { parsePaths } from "./metadata-parser"
import { templateSections } from "./template-sections"

export function parseTemplate(text: string, path = "<template>"): Result<TemplateDocument> {
  try {
    const sections = templateSections(text)

    return success({
      path,
      paths: parsePaths(sections.metadata),
      nodes: parseBody(sections.body),
    })
  } catch (error) {
    return failure([error instanceof Error ? error.message : String(error)])
  }
}
