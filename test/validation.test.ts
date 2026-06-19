import { describe, expect, test } from "bun:test"
import { validateFiles } from "../src/application/validation/validate-files"
import { countTypeScriptVariables } from "../src/infrastructure/language/typescript"
import { parseTemplate } from "../src/infrastructure/parser/parse-template"

describe("project validation", () => {
  test("accepts right fixtures and rejects wrong fixtures", async () => {
    const report = validateFiles({
      parseTemplate,
      variableCounter: countTypeScriptVariables,
      templates: await readTemplates(),
      files: await readFixtures(),
    })

    expect(report.valid).toBe(false)
    expect(validityOf(report, "/test/objects/SimpleDummy.right.ts")).toBe(true)
    expect(validityOf(report, "/test/objects/SimpeDummy.wrong.ts")).toBe(false)
    expect(validityOf(report, "/test/objects/DummyModule.right.ts")).toBe(true)
    expect(validityOf(report, "/test/objects/DummyModule.wrong.ts")).toBe(false)
    expect(validityOf(report, "/test/objects/DummyComponent.right.svelte")).toBe(true)
    expect(validityOf(report, "/test/objects/DummyComponent.wrong.svelte")).toBe(false)
  })

  test("warns when bounded repeats have no language counter", () => {
    const report = validateFiles({
      parseTemplate,
      templates: [{ path: "/unknown.spec", content: "---\npaths: /sample.txt\n---\n**1" }],
      files: [{ path: "/sample.txt", content: "alpha\nbeta" }],
    })

    expect(report.valid).toBe(true)
    expect(report.warnings).toEqual(["No variable counter available for /sample.txt; skipped **N bounds"])
  })
})

async function readTemplates() {
  return Promise.all([
    readFile("/.spec/templates/simple.spec"),
    readFile("/.spec/templates/module.spec"),
    readFile("/.spec/templates/component.spec"),
  ])
}

async function readFixtures() {
  return Promise.all([
    readFile("/test/objects/SimpleDummy.right.ts"),
    readFile("/test/objects/SimpeDummy.wrong.ts"),
    readFile("/test/objects/DummyModule.right.ts"),
    readFile("/test/objects/DummyModule.wrong.ts"),
    readFile("/test/objects/DummyComponent.right.svelte"),
    readFile("/test/objects/DummyComponent.wrong.svelte"),
  ])
}

async function readFile(path: string) {
  return {
    path,
    content: await Bun.file(path.slice(1)).text(),
  }
}

function validityOf(report: { files: Array<{ path: string; valid: boolean }> }, path: string) {
  return report.files.find((file) => file.path === path)?.valid
}
