import type { TextFile } from "../../application/validation/types"

export async function readProjectFiles(root: string, patterns: string[]): Promise<TextFile[]> {
  const files = await Promise.all(patterns.map((pattern) => readGlob(root, cleanPattern(pattern), isProjectFile)))

  return uniqueFiles(files.flat())
}

export async function readTemplateFiles(root: string): Promise<TextFile[]> {
  return readGlob(root, ".spec/templates/**/*.spec", () => true)
}

async function readGlob(root: string, pattern: string, keep: (path: string) => boolean): Promise<TextFile[]> {
  const glob = new Bun.Glob(pattern)
  const paths = await Array.fromAsync(glob.scan({ cwd: root, dot: true, onlyFiles: true }))

  return Promise.all(paths.filter(keep).map((path) => readTextFile(root, path)))
}

async function readTextFile(root: string, path: string): Promise<TextFile> {
  return { path: `/${path}`, content: await Bun.file(`${root}/${path}`).text() }
}

function isProjectFile(path: string): boolean {
  return !path.startsWith("node_modules/") && !path.startsWith(".git/") && !path.startsWith(".spec/")
}

function cleanPattern(pattern: string): string {
  return pattern.replace(/^\//, "")
}

function uniqueFiles(files: TextFile[]): TextFile[] {
  return [...new Map(files.map((file) => [file.path, file])).values()]
}
