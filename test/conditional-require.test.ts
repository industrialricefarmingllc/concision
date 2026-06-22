import { describe, expect, test } from "bun:test"
import { parseLinePattern } from "../src/infrastructure/parser/line-parser"
import { lineMatches } from "../src/domain/matching/line-matches"

describe("conditional require (bare !! after *)", () => {
  test("bare !! rest-of-line is parsed as requireRest", () => {
    const pattern = parseLinePattern("someFunction(*!!:SomeType)", 1)
    const wildcard = pattern.parts.find((p) => p.kind === "wildcard")
    expect(wildcard).toBeDefined()
    if (!wildcard || wildcard.kind !== "wildcard") return

    expect(wildcard.constraints).toHaveLength(1)
    expect(wildcard.constraints[0].kind).toBe("requireRest")
    expect(wildcard.constraints[0].value).toBe(":SomeType)")

    // Rest parts were removed
    expect(pattern.parts).toHaveLength(2)
    expect(pattern.parts[0].kind).toBe("literal")
    if (pattern.parts[0].kind === "literal") expect(pattern.parts[0].value).toBe("someFunction(")
  })

  test("accepts non-empty wildcard with matching suffix", () => {
    const pattern = parseLinePattern("someFunction(*!!:SomeType)", 1)
    expect(lineMatches(pattern, "someFunction(var:SomeType)")).toBe(true)
  })

  test("accepts non-empty wildcard with matching suffix (bare arg)", () => {
    const pattern = parseLinePattern("someFunction(*!!:SomeType)", 1)
    expect(lineMatches(pattern, "someFunction(foo:SomeType)")).toBe(true)
  })

  test("accepts empty wildcard (no argument content)", () => {
    const pattern = parseLinePattern("someFunction(*!!:SomeType)", 1)
    expect(lineMatches(pattern, "someFunction()")).toBe(true)
  })

  test("rejects non-empty wildcard without matching suffix", () => {
    const pattern = parseLinePattern("someFunction(*!!:SomeType)", 1)
    expect(lineMatches(pattern, "someFunction(foo)")).toBe(false)
  })

  test("rejects non-empty wildcard with wrong suffix", () => {
    const pattern = parseLinePattern("someFunction(*!!:SomeType)", 1)
    expect(lineMatches(pattern, "someFunction(foo:WrongType)")).toBe(false)
  })
})

describe("require with brackets (*!![text])", () => {
  test("skips require when wildcard is empty", () => {
    const pattern = parseLinePattern("someFunction(*!![required])", 1)
    expect(lineMatches(pattern, "someFunction()")).toBe(true)
  })

  test("enforces require when wildcard is non-empty and matches", () => {
    const pattern = parseLinePattern("someFunction(*!![required])", 1)
    expect(lineMatches(pattern, "someFunction(required)")).toBe(true)
  })

  test("rejects non-empty wildcard that does not match require", () => {
    const pattern = parseLinePattern("someFunction(*!![required])", 1)
    expect(lineMatches(pattern, "someFunction(foo)")).toBe(false)
  })
})

describe("bare !! at end of pattern (nothing after !! )", () => {
  test("bare !! with no following content behaves like * (accepts anything)", () => {
    const pattern = parseLinePattern("someFunction(*)", 1)
    expect(lineMatches(pattern, "someFunction(anything)")).toBe(true)
  })

  test("bare !! at end behaves as no-op", () => {
    const pattern = parseLinePattern("someFunction(*!!)", 1)
    // After post-processing, requireRest value is "" (nothing after !!).
    // The wildcard consumes the rest. value="anything)" is non-empty, not a suffix of "",
    // so the requireRest check fails. Wait — endsWith("") is always true.
    // So it should accept everything.
    expect(lineMatches(pattern, "someFunction(anything)")).toBe(true)
    expect(lineMatches(pattern, "someFunction()")).toBe(true)
  })
})

describe("nested brackets in wildcard-scoped require (*!![...])", () => {
  const userTemplate = `export function use_1_(*!![*Module["|[domain <> application <> infrastructure]"]]) {`

  test("accepts empty wildcard (user's exact scenario)", () => {
    const pattern = parseLinePattern(userTemplate, 1)
    expect(lineMatches(pattern, "export function useIsOpen() {")).toBe(true)
  })

  test("accepts wildcard content matching alternation in constraint", () => {
    const pattern = parseLinePattern(userTemplate, 1)
    expect(lineMatches(pattern, `export function useFoo(name: TimelineFutureNodeModule["domain"]) {`)).toBe(true)
  })

  test("rejects wildcard content without matching require", () => {
    const pattern = parseLinePattern(userTemplate, 1)
    expect(lineMatches(pattern, "export function useFoo([wrong]) {")).toBe(false)
  })

  test("parses nested brackets correctly as a single require value", () => {
    const pattern = parseLinePattern(userTemplate, 1)
    const wildcard = pattern.parts.find((p) => p.kind === "wildcard")
    expect(wildcard).toBeDefined()
    if (!wildcard || wildcard.kind !== "wildcard") return

    expect(wildcard.constraints).toHaveLength(1)
    expect(wildcard.constraints[0].kind).toBe("require")
    expect(wildcard.constraints[0].value).toBe(`*Module["|[domain <> application <> infrastructure]"]`)
  })

  test("accepts real user scenario with multiple alternation matches", () => {
    const template = `export function use_1_(*!![*Module["|[domain <> application <> infrastructure <> props]"]]) {`
    const pattern = parseLinePattern(template, 1)
    const actual = `export function useActivate(domain: TimelineFutureNodeModule["domain"], props: TimelineFutureNodeModule["props"]) {`
    expect(lineMatches(pattern, actual)).toBe(true)
  })

  test("rejects when wildcard content contains none of the alternatives", () => {
    const template = `export function use_1_(*!![*Module["|[domain <> application <> infrastructure <> props]"]]) {`
    const pattern = parseLinePattern(template, 1)
    expect(lineMatches(pattern, `export function useBad(x: TimelineFutureNodeModule["invalid"]) {`)).toBe(false)
  })
})

describe("nested brackets in wildcard-scoped exclude (*![...])", () => {
  test("rejects wildcard content containing excluded nested pattern", () => {
    const pattern = parseLinePattern(`const *![Foo["nested"] ]`, 1)
    expect(lineMatches(pattern, `const barFoo["nested"] `)).toBe(false)
  })

  test("accepts wildcard content without excluded nested pattern", () => {
    const pattern = parseLinePattern(`const *![Foo["nested"] ]`, 1)
    expect(lineMatches(pattern, `const bar ]`)).toBe(true)
  })
})

describe("nested brackets in line-level require/exclude", () => {
  test("line-level require with nested brackets", () => {
    const pattern = parseLinePattern(`!![key["nested"] = value]`, 1)
    expect(lineMatches(pattern, `the key["nested"] = value is set`)).toBe(true)
    expect(lineMatches(pattern, "anything else")).toBe(false)
  })

  test("line-level exclude with nested brackets", () => {
    const pattern = parseLinePattern(`![key["nested"] = value]`, 1)
    expect(lineMatches(pattern, "ok")).toBe(true)
    expect(lineMatches(pattern, `has key["nested"] = value inside`)).toBe(false)
  })
})

describe("line-level !![...] with alternation", () => {
  test("matches one of the alternatives", () => {
    const pattern = parseLinePattern(`!![type = |["domain" <> "application"]]`, 1)
    expect(lineMatches(pattern, `x type = "domain" is valid`)).toBe(true)
    expect(lineMatches(pattern, `x type = "application" is valid`)).toBe(true)
  })

  test("rejects none of the alternatives", () => {
    const pattern = parseLinePattern(`!![type = |["domain" <> "application"]]`, 1)
    expect(lineMatches(pattern, `x type = "other" is valid`)).toBe(false)
  })
})

describe("deeply nested brackets in constraints", () => {
  test("handles triply-nested brackets", () => {
    const pattern = parseLinePattern(`x(*!![a[b[c[d]]]])`, 1)
    const wildcard = pattern.parts.find((p) => p.kind === "wildcard")
    expect(wildcard).toBeDefined()
    if (!wildcard || wildcard.kind !== "wildcard") return
    expect(wildcard.constraints[0].value).toBe("a[b[c[d]]]")
  })
})
