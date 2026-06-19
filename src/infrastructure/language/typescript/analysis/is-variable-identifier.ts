import ts from "typescript"

export function isVariableIdentifier(node: ts.Identifier): boolean {
  if (isTypeOnly(node) || isPropertyName(node) || isCallCallee(node) || isImportName(node)) return false
  if (isDeclarationName(node)) return true
  return !isDeclarationLabel(node)
}

function isDeclarationName(node: ts.Identifier): boolean {
  const parent = node.parent
  return (ts.isVariableDeclaration(parent) || ts.isParameter(parent)) && parent.name === node
}

function isDeclarationLabel(node: ts.Identifier): boolean {
  const parent = node.parent
  return (
    (ts.isFunctionDeclaration(parent) && parent.name === node) ||
    (ts.isClassDeclaration(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node)
  )
}

function isPropertyName(node: ts.Identifier): boolean {
  const parent = node.parent
  return ts.isPropertyAccessExpression(parent) && parent.name === node
}

function isCallCallee(node: ts.Identifier): boolean {
  for (let current: ts.Node = node; current.parent; current = current.parent) {
    if (ts.isCallExpression(current.parent)) return current.parent.expression === current
  }

  return false
}

function isTypeOnly(node: ts.Identifier): boolean {
  return hasAncestor(node, (parent) => ts.isTypeNode(parent) || ts.isInterfaceDeclaration(parent) || ts.isTypeAliasDeclaration(parent))
}

function isImportName(node: ts.Identifier): boolean {
  const parent = node.parent
  return (
    ts.isImportSpecifier(parent) ||
    ts.isImportClause(parent) ||
    ts.isNamespaceImport(parent) ||
    ts.isImportEqualsDeclaration(parent)
  )
}

function hasAncestor(node: ts.Node, matches: (node: ts.Node) => boolean): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if (matches(current)) return true
  }

  return false
}
