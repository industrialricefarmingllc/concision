import { unsupportedVariables, type VariableCount, type VariableCounterInput } from "../../../../domain/language/variable-counter"
import { collectVariableIdentifiers } from "../analysis/collect-variable-identifiers"
import { isTypeScriptLike } from "./is-type-script-like"
import { parseTypeScriptSource } from "../parser/parse-type-script-source"

export function countTypeScriptVariables(input: VariableCounterInput): VariableCount {
  if (!isTypeScriptLike(input.filePath)) return unsupportedVariables()

  const sourceFile = parseTypeScriptSource(input)
  return { supported: true, count: collectVariableIdentifiers(sourceFile).size }
}
