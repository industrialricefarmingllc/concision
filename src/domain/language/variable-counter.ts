export type VariableCounter = (input: VariableCounterInput) => VariableCount

export type VariableCounterInput = {
  filePath: string
  content: string
}

export type VariableCount = SupportedVariableCount | UnsupportedVariableCount

export type SupportedVariableCount = {
  supported: true
  count: number
}

export type UnsupportedVariableCount = {
  supported: false
}

export function unsupportedVariables(): VariableCount {
  return { supported: false }
}
