# @textsetu/sdk

Official TypeScript SDK for the [TextSetu](https://textsetu.com) translation
management API. Fully typed, generated from the OpenAPI spec, and isomorphic —
it runs on Node 18+ and in the browser.

```bash
npm install @textsetu/sdk
```

## Quick start

```ts
import { TextSetu } from "@textsetu/sdk";

const ts = new TextSetu({ token: process.env.TEXTSETU_TOKEN! });

const { keys, total } = await ts.listKeys({
  path: { projectId },
  query: { search: "checkout", limit: 50 },
});
```

Responses are unwrapped for you: the API sends `{ success: true, data: … }` on
the wire, and the SDK returns the payload directly.

Don't have a project id yet? `listProjects` returns every project the token can
read, so you can offer a picker instead of hard-coding one:

```ts
const { projects } = await ts.listProjects();
// → [{ id, name, orgId, sourceLanguage, keySeparator, approvalRequired }, …]
```

## Authentication

Pass a token created in the TextSetu app:

| Token                 | Prefix       | Acts as                                                            |
| --------------------- | ------------ | ------------------------------------------------------------------ |
| Personal access token | `tsu_pat_…`  | you — inherits your permissions across every project you can reach |
| Project token         | `tsu_proj_…` | a machine bound to **one** project                                 |

Authorization is **permission-based**: every token carries an explicit allow-list
of RBAC permission keys (`translation_read`, `translation_create`, …), and each
operation declares the one it needs. A token's effective access is its underlying
authority ∩ its allow-list, so a personal access token can never exceed what you
already have. There are no coarse `read`/`write`/`manage` scopes.

Glossaries and translation memories are organization-level resources shared
across projects, so **managing** them requires a personal access token. Using
them — TM matches, concordance search, glossary lookup — works with either
token type, because those calls are project-scoped.

## Translating with translation memory and glossary

The calls worth knowing about, in the order you'd use them:

```ts
// 1. Reuse what's already been translated.
const { matches } = await ts.getTmMatches({
  path: { projectId },
  body: { sourceTexts: ["Proceed to checkout"], languageCodes: ["fr"] },
});

// 2. No good whole-segment match? Find prior usage of the phrase instead.
const { items } = await ts.searchTm({
  path: { projectId },
  body: { query: "checkout", languageCodes: ["fr"] },
});

// 3. Respect required terminology.
const { matches: terms } = await ts.lookupGlossaryTerms({
  path: { projectId },
  body: { sourceTexts: ["Proceed to checkout"], languageCodes: ["fr"] },
});

// 4. Check your draft before saving it.
const { issues } = await ts.checkGlossary({
  path: { projectId },
  body: {
    sourceText: "Proceed to checkout",
    targetText: "…",
    languageCode: "fr",
  },
});
```

`getTmMatches` scores whole-segment similarity, so a segment that merely
_contains_ your phrase won't surface — that's what `searchTm` (concordance) is
for.

## Error handling

Failures throw a `TextSetuApiError` carrying a stable machine-readable `code`
(branch on this — `message` is human-facing and may be reworded):

```ts
import { TextSetuApiError } from "@textsetu/sdk";

try {
  await ts.createKey({ path: { projectId }, body: { key: "cart.empty" } });
} catch (err) {
  if (err instanceof TextSetuApiError) {
    console.error(err.code, err.status, err.message);
  }
}
```

## Options

```ts
new TextSetu({
  token: "tsu_pat_…",
  baseUrl: "https://textsetu.example.com/api/v1", // self-hosted
  fetch: customFetch, // proxy agent, tests, …
});
```

Need something the wrapper doesn't expose? `ts.raw` is the underlying generated
client, for interceptors and other advanced use.

## Contributing

`src/generated/` is produced from the API's OpenAPI spec — don't edit it by
hand. Regenerate with:

```bash
pnpm generate       # regenerate from the spec
pnpm generate:check # fail if the committed client is stale
```

Method names come from the spec's `operationId`s, so they're stable across path
changes.

## License

MIT
