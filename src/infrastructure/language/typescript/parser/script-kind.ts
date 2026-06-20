import * as ts from "typescript"

export function scriptKind(path: string): ts.ScriptKind {
  if (path.endsWith(".tsx") || path.endsWith(".jsx")) return ts.ScriptKind.TSX
  if (path.endsWith(".js") || path.endsWith(".mjs") || path.endsWith(".cjs")) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}
