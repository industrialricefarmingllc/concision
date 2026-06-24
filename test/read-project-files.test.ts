import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, test } from "bun:test"
import { readProjectFilePaths } from "../src/infrastructure/filesystem/read-project-files"
import type { TemplateDocument } from "../src/domain/language/types"

describe("readProjectFilePaths", () => {
  test("filters files with negative glob segments", async () => {
    const root = await mkdtemp(join(tmpdir(), "concision-glob-"))

    try {
      await mkdir(join(root, "src/routes"), { recursive: true })
      await mkdir(join(root, "src/.svelte-kit/generated"), { recursive: true })
      await writeFile(join(root, "src/routes/+page.svelte"), "")
      await writeFile(join(root, "src/.svelte-kit/generated/+page.svelte"), "")

      const templates: TemplateDocument[] = [
        {
          path: "test.spec",
          paths: ["/**/*.svelte"],
          exclude: ["/**/.svelte-kit/**"],
          nodes: [],
        },
      ]

      const paths = await readProjectFilePaths(root, templates)

      expect(paths).toEqual(["/src/routes/+page.svelte"])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("excludes files matching exclude patterns", async () => {
    const root = await mkdtemp(join(tmpdir(), "concision-glob-"))

    try {
      await mkdir(join(root, "src"), { recursive: true })
      await writeFile(join(root, "src/hook.ts"), "")
      await writeFile(join(root, "src/useAuth.svelte.ts"), "")
      await writeFile(join(root, "src/AuthModule.svelte.ts"), "")

      const templates: TemplateDocument[] = [
        {
          path: "test.spec",
          paths: ["/**/*.ts"],
          exclude: ["/**/use*.svelte.ts", "/**/*Module.svelte.ts"],
          nodes: [],
        },
      ]

      const paths = await readProjectFilePaths(root, templates)

      expect(paths).toEqual(["/src/hook.ts"])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
