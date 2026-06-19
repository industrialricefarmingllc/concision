import ts from "typescript"
import type { VariableCounterInput } from "../../../../domain/language/variable-counter"
import { scriptKind } from "./script-kind"

export function parseTypeScriptSource(input: VariableCounterInput): ts.SourceFile {
  return ts.createSourceFile(input.filePath, input.content, ts.ScriptTarget.Latest, true, scriptKind(input.filePath))
}
