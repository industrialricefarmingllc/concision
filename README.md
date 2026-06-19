# concision

Imagine knowing what your LLM returns *before* you prompt it. With concision, you define templates and know they'll be adhered to 100% of the time. Linting for your code architecture.

## Why
We design code architectures so that even as our code grows, the mechanism we interact with, our architecture, remains a simple tool for us to wield. An invisible layer of abstraction that forms the real machine we're building. Too invisible perhaps, because LLMs just cannot stop drifting to the mean of their training, ignoring conventions left and right.

That is because until now, there was no way to enforce a stable format the agent's output has to adhere to.

Concision solves this by acting as a linter for abstract code templates. You define the template, AI gets it wrong, concision will tell the AI why it's wrong and how it can be solved. **Nothing passes until it matches your specifications.**

## Example
```
---
paths: **/*.ts
---
~import**

export function *(*) { | export async function *(*) {
  **5
}
```
- Covers all .ts files
- Allows optional (~) import lines, as many as wanted (\*\*)
- Requires the export of a regular OR (|) async function
- Allows any function name (\*) and any parameters, if any (\*)
- Allows any number of lines with a maximum of 5 variables (**5) to reign in cognitive load


## Syntax
`~` this line optional (wrap a code block for multi-line optionality)

`*` allow any text until the next concrete symbol

`**` allow any number of lines with that line's rules (end of line only)<br>

TODO: Add remaining (it's 37C rn i'm dying)

## How

Run it with:

```bash
bun x @nicerice/concision
npm exec @nicerice/concision
pnpm dlx @nicerice/concision
concision check
```
