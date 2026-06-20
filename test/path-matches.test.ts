import { describe, expect, test } from "bun:test"
import { pathMatches } from "../src/application/validation/path-matches"

describe("pathMatches", () => {
  test("matches globstar and wildcard patterns", () => {
    expect(pathMatches("/src/routes/+page.svelte", "/**/*.svelte")).toBe(true)
    expect(pathMatches("/src/routes/+page.ts", "/**/*.svelte")).toBe(false)
  })

  test("supports full-segment negative patterns", () => {
    const glob = "/**/!(*.svelte-kit)/**/*.svelte"

    expect(pathMatches("/src/routes/+page.svelte", glob)).toBe(true)
    expect(pathMatches("/src/.svelte-kit/generated/+page.svelte", glob)).toBe(false)
  })
})
