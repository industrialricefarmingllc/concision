import { parseLines } from "./parse-lines"

export function parseBody(body: string, lineOffset = 1) {
  return parseLines(body.trim().split(/\r?\n/), lineOffset)
}
