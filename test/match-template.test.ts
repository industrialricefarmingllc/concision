import { describe, expect, test } from "bun:test"
import { highlightDiagnostic } from "../src/domain/matching/diagnostic-highlight"
import { matchTemplate } from "../src/domain/matching/match-template"
import { countTypeScriptVariables } from "../src/infrastructure/language/typescript"
import { parseTemplate } from "../src/infrastructure/parser/parse-template"

describe("matchTemplate", () => {
  test("keeps template diagnostics separate from the source line", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nhello", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "bye" })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("Template: template.spec")
    expect(result.sourceLine).toBe(1)
  })

  test("shows the actual source block for multi-line alternation failures", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\n|[\ndomain = {}\n<> domain = {\n  *: use*(*)**\n}\n]", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "domain = {\nbroken\n}" })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("Expected: }")
    expect(result.errors[0]).not.toContain("Violated:")
    expect(result.errors[0]).not.toContain("Not matching OR conditions")
    expect(result.errors[0]).toContain(`Actual: ${highlightDiagnostic("broken")}`)
  })

  test("extends actual source blocks through repeated lines to the first violation", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\n|[\ndomain = {}\n<> domain = {\n  *: use*(*)**\n}\n]", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, {
      filePath: "/checked/file.ts",
      content: [
        "domain = {",
        "containerSize: useContainerSize(),",
        "now: useNow(),",
        "scaleMs: useScaleMs(),",
        "situation: useSituation(),",
        "timelineData: {} as Record<string, any>,",
        "}",
      ].join("\n"),
    })

    expect(result.valid).toBe(false)
    expect(result.sourceLine).toBe(6)
    expect(result.errors[0]).toContain("Expected: }")
    expect(result.errors[0]).toContain(`Actual: ${highlightDiagnostic("timelineData: {} as Record<string, any>,")}`)
  })

  test("does not diagnose skipped optional content as extra source", () => {
    const template = parseTemplate("---\npaths: /checked/*.svelte\n---\n~[<style>\n</style>]", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.svelte", content: "<script>" })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).not.toContain("Expected: end of template")
    expect(result.errors[0]).toContain("Expected: <style> ↵ </style>")
    expect(result.sourceLine).toBe(1)
  })

  test("does not skip an optional block after the source starts it", () => {
    const template = parseTemplate("---\npaths: /checked/*.svelte\n---\n~[<script>\nconst module = *Module.getInstance(*)\n</script>]", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.svelte", content: "<script>\n</script>" })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).not.toContain("Expected: end of template")
    expect(result.errors[0]).toContain("Expected: const module = *Module.getInstance(*)")
    expect(result.sourceLine).toBe(2)
  })

  test("allows inline repeat patterns to match zero lines", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\ncall(**)", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "call()" })

    expect(result.valid).toBe(true)
  })

  test("allows inline repeat patterns to span multiple source lines", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\ncall(**)", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "call(\n  first,\n  second\n)" })

    expect(result.valid).toBe(true)
  })

  test("applies single wildcard exclusions to wildcard content", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nset value(*) {![nextValue]", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "set value(nextValue) {" })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("The wildcard forbids text `nextValue`, but its matched content is `nextValue`.")
  })

  test("does not apply single wildcard exclusions to literal text outside the wildcard", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nconst nextValue = *![nextValue]", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "const nextValue = value" })

    expect(result.valid).toBe(true)
  })

  test("allows blank lines after optional rules to be omitted", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\n~[import **]\n\nexport const value = 1", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "export const value = 1" })

    expect(result.valid).toBe(true)
  })

  test("allows blank lines after negated rules to be omitted", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nconst value = *![bad]\n\nexport const done = true", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "const value = good\nexport const done = true" })

    expect(result.valid).toBe(true)
  })

  test("allows blank line before bare ~ to be optional", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nimport * from \"*\"\n\n~\n\nexport const value = 1", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    // source with no blank line
    let result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "import { x } from \"x\"\nexport const value = 1" })
    expect(result.valid).toBe(true)

    // source with one blank line (the optional one)
    result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "import { x } from \"x\"\n\nexport const value = 1" })
    expect(result.valid).toBe(true)
  })

  test("allows blank line before ** operator to be optional", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nconst a = 1\n\n**\nconst z = 2", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    // source with no blank line
    let result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "const a = 1\nconst z = 2" })
    expect(result.valid).toBe(true)

    // source with one blank line
    result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "const a = 1\n\nconst z = 2" })
    expect(result.valid).toBe(true)
  })

  test("allows blank line after ** operator to be optional", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nconst a = 1\n**\n\nconst z = 2", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    // source with no blank line
    let result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "const a = 1\nconst z = 2" })
    expect(result.valid).toBe(true)

    // source with one blank line
    result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "const a = 1\n\nconst z = 2" })
    expect(result.valid).toBe(true)
  })

  test("caps surrounding blanks at one around bare ~", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nconst a = 1\n\n~\n\nconst b = 2", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    // source with no blank line — the one optional blank is skipped
    let result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "const a = 1\nconst b = 2" })
    expect(result.valid).toBe(true)

    // source with one blank line — the optional blank is consumed
    result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "const a = 1\n\nconst b = 2" })
    expect(result.valid).toBe(true)

    // source with two blank lines — cap ensures only one optional; second blank fails
    result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "const a = 1\n\n\nconst b = 2" })
    expect(result.valid).toBe(false)
  })

  test("allows blank line before ~[...] to stay required", () => {
    // ~[...] blocks keep their before-blank as a required structural blank
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nconst a = 1\n\n~[foo]\n\nconst b = 2", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    // source with a blank line — the required before-blank matches
    let result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "const a = 1\n\nconst b = 2" })
    expect(result.valid).toBe(true)

    // source without blank line fails — required blank missing
    result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "const a = 1\nconst b = 2" })
    expect(result.valid).toBe(false)
  })

  test("applies inline wildcard exclusions to that wildcard only", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\n*: use*(*![{]), **", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "value: useValue({ input })," })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("The wildcard forbids text `{`, but its matched content is `{ input }`.")
  })

  test("allows wildcard patterns inside inline wildcard exclusions", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\n*: use*(*![{*}]), **", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "value: useValue({ input })," })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("The wildcard forbids text `{*}`, but its matched content is `{ input }`.")
  })

  test("allows empty wildcard content with inline wildcard exclusions", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\n**[*: use*(*![{*}]),]", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "isOpen: useIsOpen()," })

    expect(result.valid).toBe(true)
  })

  test("fails repeated line negations instead of stopping before the violating line", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\n*: use*(*), **![props]", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "props: useProps(props)," })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("The rule forbids text `props`, but the matched block contains it.")
  })

  test("fails repeated lines with direct wildcard exclusions", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\n*![props]: use*(*), **", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "props: useProps(props)," })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("The wildcard forbids text `props`, but its matched content is `props`.")
  })

  test("applies inline repeat exclusions across consumed source lines", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\ncall(**)![forbidden]", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "call(\n  forbidden\n)" })

    expect(result.valid).toBe(false)
    expect(result.sourceLine).toBe(2)
    expect(result.errors[0]).toContain("The rule forbids text `forbidden`, but the matched block contains it.")
    expect(result.errors[0]).toContain(`Actual: call( ↵ ${highlightDiagnostic("forbidden")} ↵ )`)
  })

  test("reuses numbered wildcard captures across lines", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nexport function use_1_() {\n  let _1_ = $state(*)\n  return _1_\n}", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, {
      filePath: "/checked/file.ts",
      content: "export function useCounter() {\n  let counter = $state(0)\n  return counter\n}",
    })

    expect(result.valid).toBe(true)
  })

  test("rejects mismatched numbered wildcard captures", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nconst _1_ = *\nreturn _1_", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "const count = 1\nreturn total" })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("The rule reuses `_1_`, captured as `count`, but this line uses `total`.")
  })

  test("allows kebab snake camel and pascal case capture alternatives", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nexport function use_1_() {\n  const snake = _1_\n  const kebab = _1_\n  return _1_\n}", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, {
      filePath: "/checked/file.ts",
      content: "export function useShoppingCart() {\n  const snake = shopping_cart\n  const kebab = shopping-cart\n  return shoppingCart\n}",
    })

    expect(result.valid).toBe(true)
  })

  test("reuses multi-digit captures on the same line", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nconst _12_ = _12_", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "const userName = user_name" })

    expect(result.valid).toBe(true)
  })

  test("rejects hook state declarations that do not reuse the captured hook name", () => {
    const template = parseTemplate(hookTemplate(), "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, {
      filePath: "/checked/useBloomPass.svelte.ts",
      content: [
        "export function useBloomPass() {",
        "  let value = $state(null)",
        "",
        "  return {",
        "    bloomPass: {",
        "      get value() {",
        "        return value",
        "      },",
        "      set value(nextValue) {",
        "        value = nextValue",
        "      },",
        "    },",
        "  }",
        "}",
      ].join("\n"),
    })

    expect(result.valid).toBe(false)
    expect(result.sourceLine).toBe(2)
    expect(result.errors[0]).toContain("Expected: let _1_ = $state(*)")
    expect(result.errors[0]).toContain("The rule reuses `_1_`, captured as `BloomPass`, but this line uses `value`.")
    expect(result.errors[0]).toContain(highlightDiagnostic("let value = $state(null)"))
  })

  test("allows catch-all optional repeats to skip before required following rules", () => {
    const template = parseTemplate(hookTemplate(), "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, {
      filePath: "/checked/useBloomPass.svelte.ts",
      variableCounter: countTypeScriptVariables,
      content: [
        "export function useBloomPass() {",
        "  let bloomPass = $state(false)",
        "",
        "  return state({",
        "    get value() {",
        "      return bloomPass",
        "    },",
        "    set value(v) {",
        "      bloomPass = v",
        "    },",
        "  })",
        "}",
      ].join("\n"),
    })

    expect(result.valid).toBe(true)
  })

  test("negates the whole line with exclusion at the start", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\n![bad]", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const good = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "const value = good" })
    expect(good.valid).toBe(true)

    const bad = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "const value = bad" })
    expect(bad.valid).toBe(false)
    expect(bad.errors[0]).toContain("The rule forbids text `bad`")
  })

  test("requires the whole line with requirement at the start", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\n!![required]", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const good = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "line with required text" })
    expect(good.valid).toBe(true)

    const bad = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "line without it" })
    expect(bad.valid).toBe(false)
    expect(bad.errors[0]).toContain("The rule requires text `required`")
  })

  test("treats ~[...] mid-line as an inline optional", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nconst module = *Module.getInstance(~[props])", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    expect(matchTemplate(template.value, { filePath: "/checked/x.ts", content: "const module = FooModule.getInstance(props)" }).valid).toBe(true)
    expect(matchTemplate(template.value, { filePath: "/checked/x.ts", content: "const module = FooModule.getInstance()" }).valid).toBe(true)
    expect(matchTemplate(template.value, { filePath: "/checked/x.ts", content: "const module = FooModule.getInstance(extra)" }).valid).toBe(false)
  })

  test("formats mid-line optional in diagnostic messages", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nconst x = *foo(~[bar])", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/x.ts", content: "const x = bad" })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("~[bar]")
  })

  test("supports capture inside inline optional", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nconst module = *Module.getInstance(~[~[_1_]])", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    expect(matchTemplate(template.value, { filePath: "/checked/x.ts", content: "const module = FooModule.getInstance(props)" }).valid).toBe(true)
    expect(matchTemplate(template.value, { filePath: "/checked/x.ts", content: "const module = FooModule.getInstance()" }).valid).toBe(true)
  })

  test("supports wildcard inside inline optional", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nconst x = *foo(~[*])", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    expect(matchTemplate(template.value, { filePath: "/checked/x.ts", content: "const x = foo(bar)" }).valid).toBe(true)
    expect(matchTemplate(template.value, { filePath: "/checked/x.ts", content: "const x = foo()" }).valid).toBe(true)
  })

  test("supports nested inline optionals", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\n*foo(~[bar~[baz]])", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    expect(matchTemplate(template.value, { filePath: "/checked/x.ts", content: "foo(barbaz)" }).valid).toBe(true)
    expect(matchTemplate(template.value, { filePath: "/checked/x.ts", content: "foo(bar)" }).valid).toBe(true)
    expect(matchTemplate(template.value, { filePath: "/checked/x.ts", content: "foo()" }).valid).toBe(true)
    expect(matchTemplate(template.value, { filePath: "/checked/x.ts", content: "foo(baz)" }).valid).toBe(false)
  })

  test("reports bounded repeat exceeded when source has more variables than allowed", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\n**[1]", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const content = ["const a = 1", "const b = 2", "const c = 3"].join("\n")
    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content, variableCounter: countTypeScriptVariables })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("allows at most 1 variable(s)")
    expect(result.errors[0]).toContain("the source has 2")
    expect(result.sourceLine).toBe(2)
  })

  test("reports bounded repeat exceeded when followed by a failing rule", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\n**[2]\nexport const value = 1", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const content = ["const x = 1", "const y = 2", "const z = 3", "export const value = 1"].join("\n")
    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content, variableCounter: countTypeScriptVariables })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("allows at most 2 variable(s)")
    expect(result.errors[0]).toContain("the source has 3")
    expect(result.sourceLine).toBe(3)
  })

  test("does not report bounded repeat exceeded when count is within bound", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\n**[2]\nexport const value = 1", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const content = ["const x = 1", "export const value = 2"].join("\n")
    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content, variableCounter: countTypeScriptVariables })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).not.toContain("allows at most")
  })
})

function hookTemplate(): string {
  return [
    "---",
    "paths: /**/use*.svelte.ts",
    "---",
    "~[import **]",
    "~",
    "export function use_1_(*) {",
    "  |[",
    "    let _1_ = $state(*)",
    "    <> let _1_ = $derived(*)",
    "    <> let _1_ = $state(",
    "      **",
    "    )",
    "  ]",
    "  ~**[3]",
    "",
    "  return state({",
    "    get value() {",
    "      return _1_",
    "    },",
    "    set value(v) {",
    "      _1_ = v",
    "    },",
    "    ~**",
    "  })",
    "}",
  ].join("\n")
}
