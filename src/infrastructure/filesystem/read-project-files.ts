import fg from "fast-glob"
import type { TemplateDocument } from "../../domain/language/types"
import type { TextFile } from "../../application/validation/types"

export async function readProjectFiles(root: string, templates: TemplateDocument[]): Promise<TextFile[]> {
  const paths = await readProjectFilePaths(root, templates)

  return Promise.all(paths.map((path) => readTextFile(root, path.slice(1))))
}

export async function readProjectFilePaths(root: string, templates: TemplateDocument[]): Promise<string[]> {
  const patterns = templates.flatMap((t) => t.paths.map(cleanPattern))
  const excludes = templates.flatMap((t) => t.exclude.map(cleanPattern))

  const entries = await fg(patterns, {
    cwd: root,
    dot: true,
    onlyFiles: true,
    ignore: ["node_modules", ".git", ".spec", "lost+found", ...excludes],
  })

  return uniquePaths(entries.map((path) => `/${path}`))
}

export async function readTemplateFiles(root: string): Promise<TextFile[]> {
  const entries = await fg(".spec/templates/**/*.spec", {
    cwd: root,
    dot: true,
    onlyFiles: true,
  })

  return Promise.all(entries.map((path) => readTextFile(root, path)))
}

async function readTextFile(root: string, path: string): Promise<TextFile> {
  return { path: `/${path}`, content: await Bun.file(`${root}/${path}`).text() }
}

function cleanPattern(pattern: string): string {
  return pattern.replace(/^\//, "")
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)]
}
