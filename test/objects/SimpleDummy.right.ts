import { add } from "../src/math"

export function SimpleDummy(value: number) {
  const doubled = value * 2
  return add(doubled, 1)
}
