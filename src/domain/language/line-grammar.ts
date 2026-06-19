export const lineGrammar = String.raw`
Start
  = parts:Part* constraints:Constraint* {
      const repeat = parts.find((part) => part.kind === "repeat") ?? null
      const cleanParts = parts.filter((part) => part.kind !== "repeat")
      return { parts: cleanParts, repeat, constraints }
    }

Part
  = Repeat
  / Wildcard
  / Literal

Repeat
  = "**" max:$[0-9]* { return { kind: "repeat", max: max ? Number(max) : null } }

Wildcard
  = "*" { return { kind: "wildcard" } }

Constraint
  = Require
  / Exclude

Require
  = "!!" value:ConstraintValue { return { kind: "require", value: value.trim() } }

Exclude
  = "!" value:ConstraintValue { return { kind: "exclude", value: value.trim() } }

ConstraintValue
  = value:(Escaped / PlainConstraint)+ { return value.join("") }

Literal
  = value:(Escaped / PlainLiteral)+ { return { kind: "literal", value: value.join("") } }

PlainConstraint
  = !"!" value:. { return value }

PlainLiteral
  = !("*" / "!" / "\\") value:. { return value }

Escaped
  = "\\" value:. { return value }
`
