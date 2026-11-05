# Official SDKs versus Vercel AI SDK: measured footprint

Measured November 4, 2026 with Node 24.22.1, npm 11.19.1, macOS arm64 and
esbuild 0.28.2. All candidate installations and prototypes were isolated in
temporary directories. Neither library's production dependencies were changed.
The numeric results, dependency inventories, and prototype source are in
[provider-size-results.json](./provider-size-results.json).

## Findings

**The official SDKs add fewer packages, but Vercel adds less installed weight in
this comparison.** Keeping the current Google/Ollama implementation, the native
route adds 40.48 MiB; Vercel adds 18.67 MiB. Vercel's representative bundle was
also smaller, although its compressed bundle advantage was modest.

| Configuration                                                    | Direct dependencies | Installed packages | Installed files, MiB | Increase, MiB | Compressed downloads, MiB |
| ---------------------------------------------------------------- | ------------------: | -----------------: | -------------------: | ------------: | ------------------------: |
| Current Google + Ollama + Zod                                    |                   3 |                 44 |                34.32 |             — |                      5.98 |
| Current + official OpenAI/Anthropic SDKs                         |                   5 |                 53 |                74.80 |         40.48 |                     12.43 |
| Current + Vercel core/OpenAI/Anthropic adapters                  |                   6 |                 56 |                52.99 |         18.67 |                      9.94 |
| Vercel cloud adapters replacing Google SDK; keep official Ollama |                   7 |                 41 |                38.88 |          4.56 |                      7.83 |
| Vercel cloud adapters plus community Ollama adapter              |                   7 |                 40 |                39.03 |          4.71 |                      7.86 |
| Current + Vercel core only                                       |                   4 |                 54 |                47.38 |         13.06 |                      8.86 |

Sizes are MiB (1,048,576 bytes). Installed size sums actual file lengths under
`node_modules`; it includes shipped sources, declarations and source maps, and
does not represent memory usage. Package counts include installed production
transitives and peers, excluding the fixture itself and measurement tooling.
Download totals sum compressed npm archives, excluding HTTP/metadata overhead and
assuming an empty cache. Existing baseline versions were retained through copied
lockfiles. New direct dependencies were pinned to the registry versions below.

The two migration rows measure dependency configurations, **not completed
feature-compatible migrations**. Removing the Google SDK would require preserving
Google authentication, GCS files, grounding, reasoning, safety settings, embeddings
and cache behavior. The community Ollama adapter offers no size advantage here;
keeping the official Ollama integration is the smaller migration.

The core-only row can support caller-supplied adapters or AI Gateway. It does not
include direct OpenAI/Anthropic adapters. Gateway is an additional service and is
not equivalent to retaining direct vendor credentials and Google project setup.

## Bundled code

I built equivalent small wrappers for both providers: text generation and native
JSON Schema output, with Zod validation. The native prototype uses Responses and
Messages; Vercel uses `generateText` and `Output.object`. Both expose callable
functions rather than executing prompts during bundling. All existing library
exports were retained in the full-library comparison.

| Node ESM bundle                              | Minified, KiB | Gzipped, KiB |
| -------------------------------------------- | ------------: | -----------: |
| Current library and all runtime dependencies |       1,200.2 |        271.2 |
| Current library + official SDK prototypes    |       1,996.5 |        451.9 |
| Current library + Vercel prototypes          |       1,831.8 |        422.7 |
| Official SDK prototypes alone, including Zod |       1,233.7 |        270.4 |
| Vercel prototypes alone, including Zod       |       1,072.0 |        242.0 |

KiB means 1,024 bytes. Bundle settings: `bundle: true`, `minify: true`,
`platform: "node"`, `target: "node24"`, `format: "esm"`, without source maps;
gzip level 9. These figures describe the measured entry points and bundler, not
all possible applications. New-provider caching, detailed metadata and full file
handling are outside these small prototypes. No migration bundle is claimed.

The native SDKs ship substantial non-runtime material: OpenAI alone has about
6.9 MiB of declarations, 5.8 MiB of maps and 5.1 MiB of TypeScript sources;
Anthropic has about 5.6 MiB, 3.6 MiB and 3.6 MiB respectively. A small dependency
count does not imply a small installed distribution. The raw results include the
complete file-category breakdowns.

## What Simple Data Analysis inherits

I examined local SDA 6.0.15 and resolved temporary copies of its production
lockfile with manifest-only journalism-ai fixtures. The baseline fixture uses the
same current dependency versions; candidate fixtures add or replace the measured
SDKs. This tests npm's downstream graph without installing DuckDB or changing SDA.

- Native additions introduce **9 new package entries**.
- Vercel additions introduce **12 new package entries**.
- Neither additive candidate changes any existing dependency version, and the
  new packages are the same ones added in the standalone installs. Consequently,
  SDA deduplication does not eliminate the measured additive footprint here.
- Replacing the Google SDK with Vercel cloud adapters adds 19 entries and removes
  20, for a net reduction of one production lockfile entry in SDA.

These lockfile counts are not whole-SDA installed-size measurements; optional
native packages vary by platform. The actual SDA dependency already references
journalism-ai, so new required SDKs become transitive installs even for SDA users
who do not call those providers.

The current journalism-ai tarball itself is only **57.7 KiB compressed** and
249.2 KiB unpacked. `npm pack --dry-run --json` reports no bundled dependencies,
and the generated entry point leaves vendor imports external. Adding required
SDKs primarily changes the downstream dependency installation, rather than
copying tens of MiB into our own archive. The exact future published package size
cannot be measured until the full implementation and documentation exist.

## Upgrade and provider-maintenance implications

**Vercel direct integration is one ecosystem, not one package.** The additive
route requires `ai`, `@ai-sdk/openai` and `@ai-sdk/anthropic`, all separately
versioned. A Google migration adds `@ai-sdk/google` and
`@ai-sdk/google-vertex`. The provider adapters implement their own integrations;
they do not depend on the corresponding official vendor SDKs. The published
manifests were inspected locally; see also the first-party documentation for
[OpenAI](https://ai-sdk.dev/providers/ai-sdk-providers/openai),
[Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic), and
[Google Vertex](https://ai-sdk.dev/providers/ai-sdk-providers/google-vertex).

Vercel maintains the common generation/structured-output interface and provider
translation. We still need compatible core/adapter versions, integration tests,
and handling for provider-specific capabilities. Official SDKs retain the same
maintenance responsibility for our local response normalization. Both sets can
be updated together; package count alone does not determine upgrade effort.
Official SDK references:
[OpenAI](https://developers.openai.com/api/reference/typescript),
[Anthropic](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript).

For future providers, Vercel saves the most local work if our shared layer accepts
caller-supplied AI SDK models. Then another vendor can often be used by installing
its adapter in the consuming application, without adding it as a required
journalism-ai dependency. Retaining only a fixed list of provider-specific
functions still requires a library change for each new provider. This is an API
design recommendation, not an implemented capability. Vercel documents its
[provider choices](https://ai-sdk.dev/docs/getting-started/choosing-a-provider)
and [provider registry](https://ai-sdk.dev/docs/ai-sdk-core/provider-management).

## Recommendation

Do not select the official SDKs on the assumption that they are lighter. In this
measurement they are substantially larger on disk, with a somewhat larger
compressed bundle.

For the smallest immediate architectural change, the official SDKs remain
reasonable: two additions, native APIs, and no existing provider migration.

For the stated combination of downstream size, future provider growth and less
integration code to maintain, **I favor evaluating Vercel as the shared cloud
provider layer**, while retaining the current public functions and official
Ollama integration. The measured Google replacement configuration is particularly
promising: more cloud providers for only 4.56 MiB above today's dependency tree.
Adoption should depend on Gemini/Vertex behavior tests, rather than assuming that
the smaller dependency graph proves feature parity.

## Follow-up: maintenance, adoption and shared implementation

Checked November 4, 2026. GitHub's repository API reported 27,743 stars and an
unarchived, recently active repository. The release feed includes stable
`ai@7.0.162`, `ai@6.0.322` and `ai@5.0.285` releases on November 3. These are
strong maintenance-activity signals; release frequency alone does not establish
release quality or eliminate major-version migration work. Sources:
[repository](https://github.com/vercel/ai),
[releases](https://github.com/vercel/ai/releases),
[7.0.162 release](https://github.com/vercel/ai/releases/tag/ai%407.0.162).

The npm downloads API reported **43,656,329 downloads of `ai` for October 28
through November 3, 2026**. Download counts include automated installs and are not
counts of unique developers. Source:
[npm download API](https://api.npmjs.org/downloads/point/2026-10-28:2026-11-03/ai).
As a concrete framework integration, Mastra documents supporting AI SDK v5, v6
and v7 behind its own Agent API in its
[August 18 integration announcement](https://mastra.ai/blog/ai-sdk-v7-support).
The evidence supports describing the project as widely adopted and actively
maintained.

The single-wrapper premise is correct for common generation: our function can
call `generateText({ model, prompt, ... })` with a caller-supplied model created
by a compatible adapter. The adapter translates the common request and provider
response. Prompt processing, local caching, `processResponse`, timing and result
normalization can therefore share one implementation. Structured generation has
the same approach through `Output.object` and a schema. Sources:
[model interface](https://ai-sdk.dev/docs/foundations/providers-and-models),
[generateText](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text),
[structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data).

Provider-specific controls still exist through namespaced `providerOptions`.
Search, reasoning, media and schema capabilities vary by provider/model; common
settings that are unsupported can generate warnings in `result.warnings`.
Embeddings use a separate API and retain our vector-identity requirements.
Sources: [provider options](https://ai-sdk.dev/docs/foundations/provider-options),
[settings](https://ai-sdk.dev/docs/ai-sdk-core/settings),
[capability comparison](https://ai-sdk.dev/providers/ai-sdk-providers).

This supports a shared generation implementation while preserving existing public
functions. New providers can often be introduced by the caller without a
journalism-ai release when they supply a compatible model adapter. The
implementation follow-up below records the implemented scope.

## Implementation follow-up

The new `askAI` entry point implements the shared pipeline with explicit OpenAI,
Anthropic, Gemini, Vertex and Ollama selection, plus caller-supplied model
adapters. Existing native generation and embedding functions retain their
interfaces and native SDK parameter passthrough. The old Google SDK is therefore
still a required dependency; this is the additive compatibility configuration,
not the Google replacement configuration measured above.

A fresh `npm ci --omit=dev --ignore-scripts` from the implementation lockfile
installed **63 runtime packages, 57.74 MiB**, with eight direct dependencies.
That is 23.42 MiB above the original baseline and below the 74.80 MiB native-SDK
addition scenario. This includes Vercel's Google and Vertex adapters as well as
the retained native SDK. See
[implementation measurement](./provider-implementation-size.json). Removing the
native SDK requires migrating its existing generation passthrough and embeddings
with compatibility coverage. No Simple Data Analysis source was modified.

## Reproduction inputs and checks

### v4 implementation follow-up (November 5)

The v4 preparation removes native generation functions and `@google/genai`, adds
`askAIPool`, and migrates cloud embeddings to the Vercel adapters. Generation now
requires explicit `AI_PROVIDER`; built-in credentials use `AI_KEY` and model
defaults use `AI_MODEL`. The provider adapters are loaded only when selected.

The final locked production install is **42 packages / 38.91 MiB**. The npm
archive is **46.6 KiB compressed**. The package count includes the small
`@types/json-schema` dependency needed by the SDK's exported model declarations
when consumers disable `skipLibCheck`. A packed consumer passes strict type
checking and mocked generation, structured output, pooling and embeddings.
See [v4 measurements](./provider-v4-size.json).

This replaces the additive implementation above; package versioning and
publication remain a separate release step. The public migration guide records
removed functions, configuration changes and embedding cache invalidation.

Pinned versions:

| Package                 | Version |
| ----------------------- | ------- |
| `@google/genai`         | 2.30.0  |
| `ollama`                | 0.6.4   |
| `zod`                   | 4.6.7   |
| `openai`                | 7.50.0  |
| `@anthropic-ai/sdk`     | 1.5.0   |
| `ai`                    | 7.0.162 |
| `@ai-sdk/openai`        | 4.0.108 |
| `@ai-sdk/anthropic`     | 4.0.96  |
| `@ai-sdk/google`        | 4.0.111 |
| `@ai-sdk/google-vertex` | 5.0.131 |
| `ollama-ai-provider-v2` | 4.1.0   |

Each isolated project used the corresponding manifest in the raw results, seeded
from this repository's lockfile, followed by:

```sh
npm install --omit=dev --ignore-scripts --no-audit --no-fund
npm ls --omit=dev --all --json
```

All six dependency trees passed `npm ls`. The raw inventory records resolved
transitive versions; a fresh install at a later date may resolve newer compatible
transitives. The bundle source fixtures are stored in the results JSON so their
scope can be reviewed and reproduced with the recorded esbuild options.

Eight mocked smoke cases passed: text and structured generation for each provider
through each implementation. They verify a single dispatched request, schema
forwarding and the returned result. No credentials or live model calls were used;
these are footprint and protocol-shape checks, not a production readiness claim.
