import { describe, expect, test } from "bun:test"
import { countTypeScriptVariables } from "../src/infrastructure/language/typescript"

describe("TypeScript variable counter", () => {
  test("counts variables and skips function calls and raw values", () => {
    const result = countTypeScriptVariables({
      filePath: "/sample.ts",
      content: "const doubled = value * 2\nreturn add(doubled, 1)",
    })

    expect(result).toEqual({ supported: true, count: 2 })
  })

  test("counts Svelte script and markup expression variables", () => {
    const result = countTypeScriptVariables({
      filePath: "/Sample.svelte",
      content: [
        "<script module>",
        "  let total = initial",
        "</script>",
        "<script lang=\"ts\">",
        "  let name: string = format(total)",
        "</script>",
        "{#if visible && name}",
        "  <h1>{name}</h1>",
        "{/if}",
      ].join("\n"),
    })

    expect(result).toEqual({ supported: true, count: 4 })
  })

  test("counts raw Svelte snippets as script content", () => {
    const result = countTypeScriptVariables({
      filePath: "/Sample.svelte",
      content: "const doubled = value * 2",
    })

    expect(result).toEqual({ supported: true, count: 2 })
  })
})
