export function svelteScriptContent(content: string): string {
  const scripts: string[] = []
  const markup = content.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, script: string) => {
    scripts.push(script)
    return ""
  }).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")

  const expressions = svelteExpressions(markup)
    .map((expression) => expressionToStatement(expression))
    .filter((statement) => statement.length > 0)

  if (scripts.length > 0 || expressions.length > 0) return [...scripts, ...expressions].join("\n")
  if (looksLikeMarkup(content)) return ""
  return content
}

function svelteExpressions(content: string): string[] {
  const expressions: string[] = []

  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== "{") continue

    const end = expressionEnd(content, index + 1)
    if (end === -1) continue

    expressions.push(content.slice(index + 1, end).trim())
    index = end
  }

  return expressions
}

function expressionEnd(content: string, start: number): number {
  let depth = 1

  for (let index = start; index < content.length; index += 1) {
    const char = content[index]
    if (char === "{") depth += 1
    if (char === "}") depth -= 1
    if (depth === 0) return index
  }

  return -1
}

function expressionToStatement(expression: string): string {
  if (expression.startsWith("/")) return ""
  if (expression.startsWith("#if ")) return `${expression.slice(4)};`
  if (expression.startsWith(":else if ")) return `${expression.slice(9)};`
  if (expression.startsWith("#each ")) return eachExpressionToStatement(expression.slice(6))
  if (expression.startsWith("@const ")) return expression.slice(7)
  if (expression.startsWith("@html ")) return `${expression.slice(6)};`
  if (expression.startsWith("@render ")) return `${expression.slice(8)};`
  if (expression.startsWith("@debug ")) return `${expression.slice(7)};`
  if (expression.startsWith(":")) return ""

  return `${expression};`
}

function eachExpressionToStatement(expression: string): string {
  const [source, rest] = expression.split(/\s+as\s+/, 2)
  const key = rest?.match(/\((.*)\)\s*$/)?.[1]
  return [source, key].filter(Boolean).map((part) => `${part};`).join("\n")
}

function looksLikeMarkup(content: string): boolean {
  return /<\/?[a-zA-Z][\w:-]*(\s|>|\/)/.test(content)
}
