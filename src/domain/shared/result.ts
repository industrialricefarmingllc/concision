export type Result<T> = Success<T> | Failure

type Success<T> = {
  ok: true
  value: T
}

type Failure = {
  ok: false
  errors: string[]
}

export function success<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function failure(errors: string[]): Result<never> {
  return { ok: false, errors }
}
