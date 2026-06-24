import type { TemplateDocument } from "../../domain/language/types"
import { failure, success, type Result } from "../../domain/shared/result"
import type { LineParseError } from "./line-parser"
import { parseBody } from "./body-parser"
import { parseExclude, parsePaths } from "./metadata-parser"
import { templateSections } from "./template-sections"

export type TemplateError = {
  path: string
  sourceLine: number
  sourceText: string
  column: number
  message: string
}

export function parseTemplate(text: string, path = "<template>"): Result<TemplateDocument> {
  try {
    const sections = templateSections(text)
    return success({
      path,
      paths: parsePaths(sections.metadata),
      exclude: parseExclude(sections.metadata),
      nodes: parseBody(sections.body, sections.bodyStartLine),
    })
  } catch (error) {
    return failure([toTemplateError(error, path)])
  }
}

function toTemplateError(error: unknown, path: string): TemplateError {
  if (isLineParseError(error)) {
    return {
      path,
      sourceLine: error.sourceLine,
      sourceText: error.sourceText,
      column: error.column,
      message: error.message,
    }
  }
  return {
    path,
    sourceLine: 0,
    sourceText: "",
    column: 0,
    message: error instanceof Error ? error.message : String(error),
  }
}

function isLineParseError(error: unknown): error is LineParseError {
  if (!error || typeof error !== "object") return false
  const candidate = error as { sourceLine?: unknown; sourceText?: unknown; column?: unknown }
  return typeof candidate.sourceLine === "number" && typeof candidate.sourceText === "string" && typeof candidate.column === "number"
}
