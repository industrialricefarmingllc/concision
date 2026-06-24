import { describe, expect, test } from "bun:test"
import { parseTemplate } from "../src/infrastructure/parser/parse-template"

describe("template parser", () => {
  test("reads metadata and alternation blocks", async () => {
    const template = await Bun.file(".spec/templates/module.spec").text()
    const result = parseTemplate(template, ".spec/templates/module.spec")

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.paths).toEqual(["/test/**/*Module*.ts"])
    expect(result.value.nodes.some((node) => node.kind === "alternation")).toBe(true)
    expect(result.value.nodes.some((node) => node.kind === "optional")).toBe(true)
  })

  test("unescapes template operators", () => {
    const result = parseTemplate("---\npaths: /x\n---\nconst value = \\*", "inline.spec")

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.nodes).toContainEqual({
      kind: "line",
      pattern: { parts: [{ kind: "literal", value: "const value = *", params: { parts: [] } }], repeat: null, constraints: [], params: { parts: [] } },
    })
  })

  test("parses numbered capture wildcards", () => {
    const result = parseTemplate("---\npaths: /x\n---\nconst _12_ = _12_", "inline.spec")

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.nodes).toContainEqual({
      kind: "line",
      pattern: {
        parts: [
          { kind: "literal", value: "const ", params: { parts: [] } },
          { kind: "capture", id: 12, params: { parts: [] } },
          { kind: "literal", value: " = ", params: { parts: [] } },
          { kind: "capture", id: 12, params: { parts: [] } },
        ],
        repeat: null,
        constraints: [],
        params: { parts: [] },
      },
    })
  })

  test("parses wildcard-scoped constraints", () => {
    const result = parseTemplate("---\npaths: /x\n---\n*: use*(*![{]), **", "inline.spec")

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.nodes).toContainEqual({
      kind: "line",
      pattern: {
        parts: [
          { kind: "wildcard", constraints: [], params: { parts: [] } },
          { kind: "literal", value: ": use", params: { parts: [] } },
          { kind: "wildcard", constraints: [], params: { parts: [] } },
          { kind: "literal", value: "(", params: { parts: [] } },
          { kind: "wildcard", constraints: [{ kind: "exclude", value: "{" }], params: { parts: [] } },
          { kind: "literal", value: "), ", params: { parts: [] } },
        ],
        repeat: { max: null, index: 6, content: null },
        constraints: [],
        params: { parts: [] },
      },
    })
  })

  test("parses wildcard-scoped constraints with explicit terminators", () => {
    const result = parseTemplate("---\npaths: /x\n---\n*![props]: use*(*), **", "inline.spec")

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.nodes).toContainEqual({
      kind: "line",
      pattern: {
        parts: [
          { kind: "wildcard", constraints: [{ kind: "exclude", value: "props" }], params: { parts: [] } },
          { kind: "literal", value: ": use", params: { parts: [] } },
          { kind: "wildcard", constraints: [], params: { parts: [] } },
          { kind: "literal", value: "(", params: { parts: [] } },
          { kind: "wildcard", constraints: [], params: { parts: [] } },
          { kind: "literal", value: "), ", params: { parts: [] } },
        ],
        repeat: { max: null, index: 6, content: null },
        constraints: [],
        params: { parts: [] },
      },
    })
  })

  test("allows wildcards inside wildcard-scoped constraints", () => {
    const result = parseTemplate("---\npaths: /x\n---\n*: use*(*![{*}]), **", "inline.spec")

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.nodes).toContainEqual({
      kind: "line",
      pattern: {
        parts: [
          { kind: "wildcard", constraints: [], params: { parts: [] } },
          { kind: "literal", value: ": use", params: { parts: [] } },
          { kind: "wildcard", constraints: [], params: { parts: [] } },
          { kind: "literal", value: "(", params: { parts: [] } },
          { kind: "wildcard", constraints: [{ kind: "exclude", value: "{*}" }], params: { parts: [] } },
          { kind: "literal", value: "), ", params: { parts: [] } },
        ],
        repeat: { max: null, index: 6, content: null },
        constraints: [],
        params: { parts: [] },
      },
    })
  })

  test("treats commas inside repeat content as text", () => {
    const result = parseTemplate("---\npaths: /x\n---\n**[*: use*(*![{*}]),]", "inline.spec")

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.nodes).toContainEqual({
      kind: "line",
      pattern: {
        parts: [
          { kind: "wildcard", constraints: [], params: { parts: [] } },
          { kind: "literal", value: ": use", params: { parts: [] } },
          { kind: "wildcard", constraints: [], params: { parts: [] } },
          { kind: "literal", value: "(", params: { parts: [] } },
          { kind: "wildcard", constraints: [{ kind: "exclude", value: "{*}" }], params: { parts: [] } },
          { kind: "literal", value: "),", params: { parts: [] } },
        ],
        repeat: { max: null, index: 6, content: null },
        constraints: [],
        params: { parts: [] },
      },
    })
  })

  test("parses line-level constraints with definitive end terminators", () => {
    const result = parseTemplate("---\npaths: /x\n---\nimport *![react]", "inline.spec")

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.nodes).toContainEqual({
      kind: "line",
      pattern: {
        parts: [
          { kind: "literal", value: "import ", params: { parts: [] } },
          { kind: "wildcard", constraints: [{ kind: "exclude", value: "react" }], params: { parts: [] } },
        ],
        repeat: null,
        constraints: [],
        params: { parts: [] },
      },
    })
  })

  test("reports the template file, source line, and a caret on a parse failure", () => {
    const result = parseTemplate("---\npaths: /x\n---\nconst ! = foo", "inline.spec")

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.errors).toHaveLength(1)
    const error = result.errors[0]!
    expect(error.path).toBe("inline.spec")
    expect(error.sourceLine).toBe(4)
    expect(error.sourceText).toBe("const ! = foo")
    expect(error.column).toBeGreaterThan(0)
    expect(error.message).toMatch(/Expected "!!", "!", "\[", or end of input/)
  })

  test("accounts for the metadata offset when reporting the source line", () => {
    const result = parseTemplate(
      "---\npaths: /x\nmore-meta\nstill-meta\n---\nconst ! = foo",
      "inline.spec",
    )

    expect(result.ok).toBe(false)
    if (result.ok) return

    const error = result.errors[0]!
    expect(error.sourceLine).toBe(6)
    expect(error.sourceText).toBe("const ! = foo")
  })

  test("reports the source line inside a nested optional block", () => {
    const result = parseTemplate(
      "---\npaths: /x\n---\n~[\n  const ! = foo\n]",
      "inline.spec",
    )

    expect(result.ok).toBe(false)
    if (result.ok) return

    const error = result.errors[0]!
    expect(error.sourceLine).toBe(5)
    expect(error.sourceText).toBe("const ! = foo")
  })

  test("reports the source line for an error inside a multi-line alternation choice", () => {
    const result = parseTemplate(
      "---\npaths: /x\n---\n|[\n  foo\n  <> bar ! baz\n]",
      "inline.spec",
    )

    expect(result.ok).toBe(false)
    if (result.ok) return

    const error = result.errors[0]!
    expect(error.sourceLine).toBe(7)
    expect(error.sourceText).toBe("bar ! baz")
  })

  test("parses inline ~[...] as an optional part", () => {
    const result = parseTemplate("---\npaths: /x\n---\nfoo(~[bar])", "inline.spec")
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const line = result.value.nodes[0]
    expect(line?.kind).toBe("line")
    if (line?.kind !== "line") return

    const optionalPart = line.pattern.parts.find((p) => p.kind === "optional")
    expect(optionalPart).toBeDefined()
    if (optionalPart?.kind !== "optional") return
    expect(optionalPart.parts).toEqual([{ kind: "literal", value: "bar", params: { parts: [] } }])
  })

  test("parses nested brackets inside inline ~[...]", () => {
    const result = parseTemplate("---\npaths: /x\n---\nfoo(~[bar[baz]])", "inline.spec")
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const line = result.value.nodes[0]
    if (line?.kind !== "line") return

    const optionalPart = line.pattern.parts.find((p) => p.kind === "optional")
    expect(optionalPart?.kind).toBe("optional")
    if (optionalPart?.kind !== "optional") return
    expect(optionalPart.parts).toEqual([{ kind: "literal", value: "bar[baz]", params: { parts: [] } }])
  })
})
