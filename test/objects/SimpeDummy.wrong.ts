import { add } from "../src/math"

export function SimpeDummy(value: number) {
  const doubled = value * 2
  const shifted = add(doubled, 1)
  const named = String(shifted)
  const message = named.toUpperCase()
  const decorated = `[${message}]`
  return decorated
}
