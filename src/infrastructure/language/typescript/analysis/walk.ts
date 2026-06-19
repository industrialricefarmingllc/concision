import ts from "typescript"

export function walk(node: ts.Node, onNode: (node: ts.Node) => void): void {
  onNode(node)
  ts.forEachChild(node, (child) => walk(child, onNode))
}
