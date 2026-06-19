import ts from "typescript"
import { isVariableIdentifier } from "./is-variable-identifier"
import { walk } from "./walk"

export function collectVariableIdentifiers(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>()

  walk(sourceFile, (node) => {
    if (ts.isIdentifier(node) && isVariableIdentifier(node)) names.add(node.text)
  })

  return names
}
