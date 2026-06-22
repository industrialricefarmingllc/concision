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
  / Literal

Repeat
  = "**" params:RepeatParams? { return { kind: "repeat", max: params?.max ?? null, content: params?.content ?? null } }

RepeatParams
  = "[" max:$[0-9]+ "]" { return { max: Number(max), content: null } }
  / "[" content:RepeatContent "]" { return { max: null, content } }

RepeatContent
  = chars:RepeatContentChar+ { return chars.join("") }

RepeatContentChar
  = RepeatContentNested
  / !"]" value:. { return value }

RepeatContentNested
  = "[" chars:RepeatContentChar* "]" { return "[" + chars.join("") + "]" }

Wildcard
  = "*" constraints:WildcardConstraint* { return { kind: "wildcard", constraints, params: { parts: [] } } }

WildcardConstraint
  = WildcardRequire
  / WildcardExclude

WildcardRequire
  = "!!" "[" value:WildcardConstraintParamValue "]" { return { kind: "require", value: value.trim() } }
  / "!!" { return { kind: "requireRest", value: "" } }

WildcardExclude
  = "!" "[" value:WildcardConstraintParamValue "]" { return { kind: "exclude", value: value.trim() } }
  / "!" { return { kind: "exclude", value: "*" } }

WildcardConstraintParamValue
  = value:(Escaped / WildcardConstraintChar)+ { return value.join("") }

WildcardConstraintChar
  = WildcardConstraintNested
  / Escaped
  / !("]" / "\\") value:. { return value }

WildcardConstraintNested
  = "[" chars:WildcardConstraintChar* "]" { return "[" + chars.join("") + "]" }

Capture
  = "_" id:$[0-9]+ "_" { return { kind: "capture", id: Number(id), params: { parts: [] } } }

Constraint
  = Require
  / Exclude

Require
  = "!!" "[" value:ConstraintParamValue "]" { return { kind: "require", value: value.trim() } }
  / "!!" { return { kind: "require", value: "*" } }

Exclude
  = "!" "[" value:ConstraintParamValue "]" { return { kind: "exclude", value: value.trim() } }
  / "!" { return { kind: "exclude", value: "*" } }

ConstraintParamValue
  = value:(Escaped / ConstraintChar)+ { return value.join("") }

ConstraintChar
  = ConstraintNested
  / Escaped
  / !("]" / "\\") value:. { return value }

ConstraintNested
  = "[" chars:ConstraintChar* "]" { return "[" + chars.join("") + "]" }

Literal
  = value:(Escaped / PlainLiteral)+ { return { kind: "literal", value: value.join(""), params: { parts: [] } } }

PlainConstraint
  = !"!" value:. { return value }

PlainWildcardConstraint
  = !("!" / "\\") value:. { return value }

PlainLiteral
  = !("*" / "!" / ("_" [0-9] [0-9]* "_") / "\\") value:. { return value }

Escaped
  = "\\" value:. { return value }
`
