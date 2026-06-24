export const lineGrammar = String.raw`
Start
  = parts:Part* constraints:Constraint* {
      const repeatPart = parts.find((part) => part.kind === "repeat") ?? null
      const repeat = repeatPart ? { max: repeatPart.max, index: parts.slice(0, parts.indexOf(repeatPart)).filter((part) => part.kind !== "repeat").length, content: repeatPart.content } : null
      const cleanParts = parts.filter((part) => part.kind !== "repeat")
      return { parts: cleanParts, repeat, constraints, params: { parts: [] } }
    }

Part
  = Repeat
  / Capture
  / Wildcard
  / Optional
  / Literal

Repeat
  = "**" params:RepeatParams? { return { kind: "repeat", max: params?.max ?? null, content: params?.content ?? null } }

RepeatParams
  = "[" max:$[0-9]+ "]" { return { max: Number(max), content: null } }
  / "[" content:BracketContent "]" { return { max: null, content } }

Wildcard
  = "*" constraints:WildcardConstraint* { return { kind: "wildcard", constraints, params: { parts: [] } } }

WildcardConstraint
  = WildcardRequire
  / WildcardExclude

WildcardRequire
  = "!!" "[" value:BracketContent "]" { return { kind: "require", value: value.trim() } }
  / "!!" { return { kind: "requireRest", value: "" } }

WildcardExclude
  = "!" "[" value:BracketContent "]" { return { kind: "exclude", value: value.trim() } }
  / "!" { return { kind: "exclude", value: "*" } }

Optional
  = "~[" content:BracketContent "]" { return { kind: "optional", content: content } }

Capture
  = "_" id:$[0-9]+ "_" { return { kind: "capture", id: Number(id), params: { parts: [] } } }

Constraint
  = Require
  / Exclude

Require
  = "!!" "[" value:BracketContent "]" { return { kind: "require", value: value.trim() } }
  / "!!" { return { kind: "require", value: "*" } }

Exclude
  = "!" "[" value:BracketContent "]" { return { kind: "exclude", value: value.trim() } }
  / "!" { return { kind: "exclude", value: "*" } }

Literal
  = value:(Escaped / PlainLiteral)+ { return { kind: "literal", value: value.join(""), params: { parts: [] } } }

PlainLiteral
  = !(("*" / "!" / ("_" [0-9] [0-9]* "_") / "\\" / "~[")  ) value:. { return value }

BracketContent
  = chars:BracketChar+ { return chars.join("") }

BracketChar
  = BracketNested
  / Escaped
  / !("]" / "\\") value:. { return value }

BracketNested
  = "[" chars:BracketChar* "]" { return "[" + chars.join("") + "]" }

Escaped
  = "\\" value:. { return value }
`
