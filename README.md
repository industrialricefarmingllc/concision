# concision

We design code architectures so that even as our code grows, the mechanism we interact with remains simple. With concision, you can define these mechanisms and know they'll be adhered to 100% of the time. Linting for your code architecture.

> Disclaimer: Due to the experimental nature of this repo, some of its modules are vibecoded. If you're sane, don't trust it yet. However, I will rewrite by hand once the interface is validated.

## Example
Say you have useFunctions with this general shape

```ts
import { state } from "@mx/svelte"
import { latLngToVec3 } from "../domain/latLngToVec3"
import { defaultAltitude, defaultLatitude, defaultLongitude } from "../constants"

export function useTransforms() {
  let position = $state(latLngToVec3(defaultLatitude, defaultLongitude, defaultAltitude))

  return state({
    get value() {
      return position
    },
    set value(v) {
      position = v
    },
    setPositionFromWorldLocation: (latitude, longitude, altitude) => (position = latLngToVec3(latitude, longitude, altitude)),
  })
}
```

We would create an abstract version without implementation details at `.spec/templates/component-module.ts`, leaving only the general shape of our code.
```ts
---
paths: /**/use*.svelte.ts
---
**[import*]

export function use_1_(*) {
  let _1_ = $state(*)

  **[3]

  return state({
    get value() {
      return _1_
    },
    set value(v) {
      _1_ = v
    },
    **
  })
}
```
- Covers all use*.svelte.ts files
- Allows optional import lines, as many as wanted (**)
- Enforces the use_1_ signature (e.g. usePosition), with _1_ capturing the hook name for later use
- Ensures $state() is created with the same captured name
- Optionally allows three more variables to be used before forcing a refactor (**[3])
- And ensures it's exported via a special accessor function
<br>
**Nothing passes until it matches your specifications.**<br>
No matter which LLM I used, it kept breaking this form in a hundred different ways. No more though :]

## Syntax

| Operator | Description |
| --- | --- |
| `~` | Optional empty line |
| `~[...]` | Optional block |
| `*` | Wildcard - matches any text until the next concrete symbol |
| `**` | Unbounded repeat - any number of matching lines (any content) |
| `**[content]` | Unbounded repeat - any number of lines matching the given format |
| `**[N]` | Bounded repeat - up to N lines (counts TS/Svelte variables) |
| `_N_` | Capture group - reuse the same text with case-variant matching (kebab, snake, camel, Pascal) |
| `\*` | Literal asterisk |
| `!` | Exclude - line must NOT match (definitive end) |
| `![text]` | Exclude - line must NOT contain text (definitive end) |
| `!!` | Require - line MUST match (definitive end) |
| `!![text]` | Require - line MUST contain text (definitive end) |
| `*![text]` / `*!![text]` | Wildcard-scoped exclude/require |
| `\|[A <> B]` | Alternation - match one of the listed options |

## Install

Run it with:

```bash
bun x @nicerice/concision
```

or install it globally:

```bash
bun i -g @nicerice/concision && concision check
```

## OpenCode Plugin

```bash
opencode plugin @nicerice/concision
```
