import type { VariableCounter } from "../language/variable-counter"
import type { TemplateDocument } from "../language/types"
import { matchNodes } from "./match-nodes"
import { sourceLines } from "./source-lines"

export type TemplateMatch = {
  valid: boolean
  warnings: string[]
}

export type MatchTemplateInput = {
  filePath: string
  content: string
  variableCounter?: VariableCounter
}

export function matchTemplate(template: TemplateDocument, input: MatchTemplateInput): TemplateMatch {
  const warnings = new Set<string>()
  const lines = sourceLines(input.content)
  const endings = matchNodes(template.nodes, lines, 0, {
    filePath: input.filePath,
    variableCounter: input.variableCounter,
    warn: (warning) => warnings.add(warning),
  })

  return { valid: endings.includes(lines.length), warnings: [...warnings] }
}
