import { unsupportedVariables, type VariableCount, type VariableCounterInput } from "../../../../domain/language/variable-counter"
import { collectVariableIdentifiers } from "../analysis/collect-variable-identifiers"
import { isTypeScriptLike } from "./is-type-script-like"
import { parseTypeScriptSource } from "../parser/parse-type-script-source"
import { svelteScriptContent } from "./svelte-script-content"

export function countTypeScriptVariables(input: VariableCounterInput): VariableCount {
  if (isSvelte(input.filePath)) {
    const sourceFile = parseTypeScriptSource({ filePath: `${input.filePath}.ts`, content: svelteScriptContent(input.content) })
    return { supported: true, count: collectVariableIdentifiers(sourceFile).size }
  }

  if (!isTypeScriptLike(input.filePath)) return unsupportedVariables()

  const sourceFile = parseTypeScriptSource(input)
  return { supported: true, count: collectVariableIdentifiers(sourceFile).size }
}

function isSvelte(path: string): boolean {
  return path.endsWith(".svelte")
}
