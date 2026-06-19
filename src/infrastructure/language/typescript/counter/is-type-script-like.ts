export function isTypeScriptLike(path: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(path)
}
