# concision

Imagine knowing what your LLM returns *before* you prompt it. With concision, you define templates and know they'll be adhered to 100% of the time. Linting for your code architecture.

## Why
We design code architectures so that even as our code grows, the mechanism we interact with, our architecture, remains a simple tool for us to wield. An invisible layer of abstraction that forms the real machine we're building. Too invisible perhaps, because LLMs just cannot stop drifting to the mean of their training, ignoring conventions left and right.

That is because until now, there was no way to enforce a stable format the agent's output has to adhere to.

Concision solves this by acting as a linter for abstract code templates. You define the template, AI gets it wrong, concision will tell the AI why it's wrong and how it can be solved. **Nothing passes until it matches your specifications.**

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
```yaml
---
paths: /**/use*.svelte.ts
---
~import **
~
export function use*(*) {
  let * = $state(*)
  ~**3

  return state({
    get value() {
      return *
    },
    set value(v) {
      * = v
    },
    ~**
  })
}
```
- Covers all use*.svelte.ts files
- Allows optional (~) import lines, as many as wanted (\*\*)
- Enforces the use* signature (e.g. usePosition)
- Ensures $state() is created
- Optionally allows three more variables to be used before forcing a refactor (~**3)
- And ensures it's exported via a special accessor function
<br>
No matter which model I used, it kept breaking this form in a hundred different ways. No more though :]

## Syntax
`~` marks this line optional (wrap a code block for multi-line optionality)

`*` allow any text until the next concrete symbol

`**` allow any number of lines with that line's rules (end of line only)<br>

TODO: Add remaining (it's 37C rn i'm dying)

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
