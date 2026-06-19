import { parseLines } from "./parse-lines"

export function parseBody(body: string) {
  return parseLines(body.trim().split(/\r?\n/))
}
