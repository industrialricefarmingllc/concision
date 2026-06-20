import type { TextFile } from "../../application/validation/types"
import { pathMatches } from "../../application/validation/path-matches"

export async function readProjectFiles(root: string, patterns: string[]): Promise<TextFile[]> {
  const paths = await readProjectFilePaths(root, patterns)

  return Promise.all(paths.map((path) => readTextFile(root, path.slice(1))))
}

export async function readProjectFilePaths(root: string, patterns: string[]): Promise<string[]> {
  const paths = await Promise.all(
    patterns.map((pattern) => readGlobPaths(root, scanPattern(cleanPattern(pattern)), (path) => isProjectFile(path) && pathMatches(`/${path}`, pattern))),
  )

  return uniquePaths(paths.flat().map((path) => `/${path}`))
}

export async function readTemplateFiles(root: string): Promise<TextFile[]> {
  return readGlob(root, ".spec/templates/**/*.spec", () => true)
}

async function readGlob(root: string, pattern: string, keep: (path: string) => boolean): Promise<TextFile[]> {
  const paths = await readGlobPaths(root, pattern, keep)

  return Promise.all(paths.map((path) => readTextFile(root, path)))
}

async function readGlobPaths(root: string, pattern: string, keep: (path: string) => boolean): Promise<string[]> {
  const glob = new Bun.Glob(pattern)
  const paths = await Array.fromAsync(glob.scan({ cwd: root, dot: true, onlyFiles: true }))

  return paths.filter(keep)
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

function scanPattern(pattern: string): string {
  return pattern
    .split("/")
    .map((segment) => (/^!\(.+\)$/.test(segment) ? "**" : segment))
    .join("/")
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)]
}
