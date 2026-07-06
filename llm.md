# The Journalism library (AI functions)

To install the library with Deno, use:

```bash
deno add jsr:@nshiab/journalism-ai
```

To install the library with Node.js, use:

```bash
npm i @nshiab/journalism-ai
```

To import a function, use:

```ts
import { functionName } from "@nshiab/journalism-ai";
```

## askAI

Interacts with a Large Language Model (LLM) to perform a wide range of tasks,
from answering questions to analyzing multimedia content. This function serves
as a versatile interface to various AI models, including Google's Gemini and
local models via Ollama.

The function is designed to be highly configurable, allowing you to specify the
AI model, credentials, and various input types such as text, images, audio,
video, and even web pages. It also includes features for caching responses to
improve performance and reduce costs, as well as for testing and cleaning the
AI's output.

**Authentication**: The function can be authenticated using environment
variables (`AI_KEY`, `AI_PROJECT`, `AI_LOCATION`, `AI_MODEL`) or by passing
credentials directly in the `options` object. Options will always take
precedence over environment variables.

**Local Models**: To use a local model with Ollama, set the `OLLAMA` environment
variable to `true` and ensure that Ollama is running on your machine. You will
also need to specify the model name using the `AI_MODEL` environment variable or
the `model` option. If you want your Ollama instance to be used, you can pass an
instance of the `Ollama` class as the `ollama` option.

**Caching**: Caching is a powerful feature that saves the AI's response to a
local directory (`.journalism-cache`). When the same request is made again, the
cached response is returned instantly, saving time and API costs. To enable
caching, set the `cache` option to `true`.

**File Handling**: The function can process both local files and files stored in
Google Cloud Storage (GCS). Simply provide the file path or the `gs://` URL.
Note that Ollama only supports local files.

**Web Search Grounding**: For Gemini models, you can enable web search grounding
by setting `webSearch` to `true`. This allows the AI to search the web for
current information and ground its responses in real-time data. Note that this
feature incurs additional API costs.

Temperature is set at 0 by default to encourage more deterministic responses.
Safety filters are enabled by default (default is `true`), but they are disabled
by default when using Vertex AI (default is `false`). Users can always override
this default with the `safetyEnabled` option.

### Signature

```typescript
async function askAI(
  prompt: string,
  options: {
    systemPrompt?: string;
    model?: string;
    apiKey?: string;
    vertex?: boolean;
    project?: string;
    location?: string;
    ollama?: boolean | any;
    webSearch?: boolean;
    HTMLFrom?: string | string[];
    screenshotFrom?: string | string[];
    image?: string | string[];
    video?: string | string[];
    audio?: string | string[];
    pdf?: string | string[];
    text?: string | string[];
    returnJson?: boolean;
    parseJson?: boolean;
    schemaJson?: unknown;
    verbose?: boolean;
    cache?: boolean;
    test?: ((response: unknown) => void) | ((response: unknown) => void)[];
    clean?: (response: unknown) => unknown;
    contextWindow?: number;
    thinkingBudget?: number;
    thinkingLevel?: "minimal" | "low" | "medium" | "high";
    includeThoughts?: boolean;
    temperature?: number;
    safetyEnabled?: boolean;
    detailedResponse: true;
    geminiParameters?: any;
    ollamaParameters?: any;
    metrics?: {
      totalCost: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalRequests: number;
    };
  },
): Promise<
  {
    response: unknown;
    rawResponse: unknown;
    fromCache: boolean;
    prompt: string;
    promptTokenCount: number;
    outputTokenCount: number;
    totalTokens: number;
    tokensPerSecond: number;
    estimatedCost?: number;
    durationMs: number;
    model: string;
    thoughts: string;
    thoughtsTokenCount: number;
  }
>;
```

### Examples

```ts
// Basic usage: Get a simple text response from the AI.
// Assumes credentials are set in environment variables.
const capital = await askAI("What is the capital of France?");
console.log(capital); // "Paris"
```

```ts
// Enable caching to save the response and avoid repeated API calls.
// A .journalism-cache directory will be created.
const cachedCapital = await askAI("What is the capital of France?", {
  cache: true,
});
```

```ts
// Pass API credentials directly as options.
const response = await askAI("What is the capital of France?", {
  apiKey: "your_api_key",
  model: "gemini-1.5-flash",
});

// Use Vertex AI for authentication.
const vertexResponse = await askAI("What is the capital of France?", {
  vertex: true,
  project: "your_project_id",
  location: "us-central1",
});
```

```ts
// Combine web search with other features for fact-checking.
const factCheck = await askAI(
  `Based on current web sources, verify the following claim and provide supporting evidence: "Renewable energy now accounts for over 30% of global electricity generation."`,
  {
    webSearch: true,
  },
);
console.log(factCheck);
```

```ts
// Return a response that conforms to a specific JSON schema.
import * as z from "zod";

const schema = z.toJSONSchema(
  z.array(z.object({
    name: z.string(),
    age: z.number(),
    gender: z.enum(["man", "woman"]),
  })),
);

await askAI("Give me 10 random people.", {
  verbose: true,
  cache: true,
  schemaJson: schema,
});
```

````ts
// Scrape and analyze HTML content from a URL.
const orders = await askAI(
  `From the following HTML, extract the executive order titles, their dates (in yyyy-mm-dd format), and their URLs. Return the data as a JSON array of objects.`,
  {
    HTMLFrom: "https://www.whitehouse.gov/presidential-actions/executive-orders/",
    returnJson: true,
  },
);
console.table(orders);

@example
```ts
// Analyze a local image file.
const personInfo = await askAI(
  `Analyze the provided image and return a JSON object with the following details:
  - name: The name of the person if they are a recognizable public figure.
  - description: A brief description of the image.
  - isPolitician: A boolean indicating if the person is a politician.`,
  {
    image: "./path/to/your_image.jpg",
    returnJson: true,
  },
);
console.log(personInfo);

// Analyze an image from Google Cloud Storage.
const gcsImageInfo = await askAI(
  `Describe the scene in this image.`,
  {
    image: "gs://your-bucket/your_image.jpg",
  },
);
console.log(gcsImageInfo);

// Transcribe an audio file.
const speechDetails = await askAI(
  `Transcribe the speech in this audio file. If possible, identify the speaker and the approximate date of the speech.`,
  {
    audio: "./path/to/speech.mp3",
    returnJson: true,
  },
);
console.log(speechDetails);

// Analyze a video file.
const videoAnalysis = await askAI(
  `Create a timeline of events from this video. For each event, provide a timestamp, a short description, and identify the main people involved.`,
  {
    video: "./path/to/your_video.mp4",
    returnJson: true,
  },
);
console.table(videoAnalysis);
````

@example

```ts
// Extract structured data from a PDF document.
const caseSummary = await askAI(
  `This is a Supreme Court decision. Provide a list of objects with a date and a brief summary for each important event of the case's merits, sorted chronologically.`,
  {
    pdf: "./path/to/decision.pdf",
    returnJson: true,
  },
);
console.table(caseSummary);

// Summarize a local text file.
const summary = await askAI(
  `Analyze the content of this CSV file and provide a summary of its key findings.`,
  {
    text: "./path/to/data.csv",
  },
);
console.log(summary);
```

@example

```ts
// Process multiple files of different types in a single call.
const multiFileSummary = await askAI(
  `Provide a brief summary for each file I've provided.`,
  {
    HTMLFrom: "https://www.un.org/en/global-issues",
    audio: "path/to/speech.mp3",
    image: "path/to/protest.jpg",
    video: "path/to/event.mp4",
    pdf: "path/to/report.pdf",
    text: "path/to/notes.txt",
    returnJson: true,
  },
);
console.log(multiFileSummary);

// Use a clean and test function to process and validate the AI's output.
const europeanCountries = await askAI(
  `Give me a list of three countries in Northern Europe.`,
  {
    returnJson: true,
    clean: (response: unknown) => {
      // Example: Trim whitespace from each country name in the array
      if (Array.isArray(response)) {
        return response.map((item) =>
          typeof item === "string" ? item.trim() : item
        );
      }
      return response;
    },
    test: (response) => {
      if (!Array.isArray(response)) {
        throw new Error("Response is not an array.");
      }
      if (response.length !== 3) {
        throw new Error("Response does not contain exactly three items.");
      }
      console.log(
        "Test passed: The response is a valid list of three countries.",
      );
    },
  },
);
console.log(europeanCountries);
```

@example

```ts
// Track cumulative metrics across multiple AI requests.
const metrics = {
  totalCost: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalRequests: 0,
};

await askAI("What is the capital of France?", { metrics });
await askAI("What is the population of Paris?", { metrics });

console.log("Total cost:", metrics.totalCost);
console.log("Total input tokens:", metrics.totalInputTokens);
console.log("Total output tokens:", metrics.totalOutputTokens);
console.log("Total requests:", metrics.totalRequests);
```

@example

```ts
// Get detailed metadata including tokens, cost, and duration.
const result = await askAI("What is the capital of France?", {
  detailedResponse: true,
});

console.log("Response:", result.response);
console.log("Model:", result.model);
// Result includes: response, prompt, promptTokenCount, outputTokenCount, totalTokens,
// tokensPerSecond, estimatedCost (for Google models), durationMs, model, thoughts, and more

// Access specific fields
console.log(`Used ${result.totalTokens} tokens in ${result.durationMs}ms`);
if (result.estimatedCost) {
  console.log(`Estimated cost: $${result.estimatedCost}`);
}
```

@param prompt - The primary text input for the AI model. @param options - A
comprehensive set of options. @param options.systemPrompt - An optional system
prompt to provide additional context or instructions to the AI model. This can
help guide the AI's response in a specific direction or tone. @param
options.model - The specific AI model to use (e.g., 'gemini-1.5-flash').
Defaults to the `AI_MODEL` environment variable. @param options.apiKey - Your
API key for the AI service. Defaults to the `AI_KEY` environment variable.
@param options.vertex - Set to `true` to use Vertex AI for authentication.
Auto-enables if `AI_PROJECT` and `AI_LOCATION` are set. @param options.project -
Your Google Cloud project ID. Defaults to the `AI_PROJECT` environment variable.
@param options.location - The Google Cloud location for your project. Defaults
to the `AI_LOCATION` environment variable. @param options.ollama - Set to `true`
to use a local Ollama model. Defaults to the `OLLAMA` environment variable. If
you want your Ollama instance to be used, you can pass it here too. @param
options.webSearch - (Gemini only) If `true`, enables web search grounding for
the AI's responses. Be careful of extra costs. Defaults to `false`. @param
options.HTMLFrom - A URL or an array of URLs to scrape HTML content from. The
content is appended to the prompt. JavaScript is not executed. @param
options.screenshotFrom - (Deprecated) A URL or an array of URLs to take a
screenshot from for analysis. This feature has been removed. Use the `image`
option instead. @param options.image - A path or GCS URL (or an array of them)
to an image file. @param options.video - A path or GCS URL (or an array of them)
to a video file. @param options.audio - A path or GCS URL (or an array of them)
to an audio file. @param options.pdf - A path or GCS URL (or an array of them)
to a PDF file. @param options.text - A path or GCS URL (or an array of them) to
a text file. @param options.returnJson - If `true`, instructs the AI to return a
JSON object. Defaults to `false`. @param options.parseJson - If `true`,
automatically parses the AI's response as JSON. Defaults to `true` if
`returnJson` is `true`, otherwise `false`. @param options.schemaJson - A Zod
JSON schema object to enforce structured output. When provided, the AI will
return data that conforms to the specified schema. Automatically enables
`returnJson` and `parseJson`. @param options.cache - If `true`, caches the
response locally in a `.journalism-cache` directory. Defaults to `false`. @param
options.verbose - If `true`, enables detailed logging, including token usage and
estimated costs. Defaults to `false`. @param options.clean - A function to
process and clean the AI's response before it is returned or tested. This
function is called after JSON parsing (if `parseJson` is `true`). The response
parameter will be the parsed JSON object if `parseJson` is true, or a string
otherwise. @param options.test - A function or an array of functions to validate
the AI's response before it's returned. @param options.contextWindow - An option
to specify the context window size for Ollama models. By default, Ollama sets
this depending on the model, which can be lower than the actual maximum context
window size of the model. @param options.thinkingBudget - Sets the reasoning
token budget: 0 to disable (default, though some models may reason regardless),
-1 for a dynamic budget, or > 0 for a fixed budget. For Ollama models, any
non-zero value simply enables reasoning, ignoring the specific budget amount.
Note: `thinkingLevel` takes precedence over `thinkingBudget` if both are
provided. @param options.thinkingLevel - Sets the thinking level for reasoning:
"minimal", "low", "medium", or "high", which some models expect instead of
`thinkingBudget`. Takes precedence over `thinkingBudget` if both are provided.
For Ollama models, any value enables reasoning. @param options.includeThoughts -
If `true`, includes the AI's reasoning thoughts in the output when using a
thinking budget or thinking level. Defaults to `false`. @param
options.temperature - Sets the temperature for response generation, controlling
the randomness of the output. A value of 0 (default) makes the output more
deterministic, while higher values (e.g., 0.7) increase creativity and
variability.`.
  @param options.safetyEnabled - Controls whether safety filters are enabled. If set to`true`, filters are active; if`false`, they are disabled. By default, this is`false`when using Vertex AI and`true`otherwise. This setting can be explicitly overridden for any model.
  @param options.detailedResponse - If`true`, returns an object containing both the response and metadata (tokens, cost, duration, etc.). Defaults to`false`.
  @param options.geminiParameters - Additional parameters to pass to the Gemini`generateContentStream`method. These will be merged with the default parameters, allowing you to override or extend the configuration (e.g., custom safety settings, generation config, system instructions).
  @param options.ollamaParameters - Additional parameters to pass to the Ollama`chat`method. These will be merged with the default parameters, allowing you to override or extend the configuration (e.g., custom options, keep_alive settings).
  @param options.metrics - An object to track cumulative metrics across multiple AI requests. Pass an object with`totalCost`,`totalInputTokens`,`totalOutputTokens`, and`totalRequests`properties (all initialized to 0). The function will update these values after each request. Note:`totalCost`
is only calculated for Google GenAI models, not for Ollama. @return
{Promise<unknown>} A Promise that resolves to the AI's response.

@category AI

## askAIPool

Processes multiple AI requests concurrently using a pool of workers. This
function wraps {@link askAI} and manages parallel execution, retries, progress
logging, and error handling for batch operations.

Each request in the array is processed by a worker from the pool. The pool size
controls how many requests run simultaneously. Results and errors are returned
separately, sorted by their original index, making it easy to match outputs back
to inputs.

### Signature

```typescript
async function askAIPool(
  requests: askAIRequest[],
  poolSize: number,
  poolOptions?: {
    logProgress?: boolean;
    retry?: number;
    retryCheck?: (error: unknown) => Promise<boolean> | boolean;
    minRequestDurationMs?: number;
    metrics?: {
      totalCost: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalRequests: number;
    };
  },
): Promise<
  {
    results: { index: number; request: askAIRequest; result: unknown }[];
    errors: Array<{ index: number; request: askAIRequest; error: unknown }>;
  }
>;
```

### Parameters

- **`requests`**: An array of request objects to process.
- **`requests[].id`**: An optional identifier for the request, useful for
  matching results back to inputs.
- **`requests[].prompt`**: The primary text input for the AI model.
- **`requests[].options`**: Options passed to {@link askAI} for each individual
  request. See {@link askAI} for the full list of available options.
- **`poolSize`**: The number of concurrent workers processing requests.
- **`poolOptions`**: Configuration for the pool execution.
- **`poolOptions.logProgress`**: If `true`, logs progress to the console after
  each completed or failed request. Defaults to `false`.
- **`poolOptions.retry`**: The maximum number of retry attempts for a failed
  request. Defaults to `0` (no retries).
- **`poolOptions.retryCheck`**: A function that receives the error and returns
  whether the request should be retried. If not provided, all failed requests
  are retried up to the `retry` limit.
- **`poolOptions.minRequestDurationMs`**: A minimum duration in milliseconds for
  each request. If a request completes faster, the worker will wait before
  picking up the next one. Useful for rate limiting.
- **`poolOptions.metrics`**: An object to track cumulative metrics across all
  requests in the pool. Pass an object with `totalCost`, `totalInputTokens`,
  `totalOutputTokens`, and `totalRequests` properties (all initialized to 0).

### Returns

A Promise that resolves to an object with `results` (successful responses with
their index and request) and `errors` (failed requests with their index,
request, and error), both sorted by original index.

### Examples

```ts
// Basic usage: Process a batch of prompts with a pool of 5 concurrent workers.
const { results, errors } = await askAIPool(
  [
    { prompt: "What is the capital of France?" },
    { prompt: "What is the capital of Germany?" },
    { prompt: "What is the capital of Italy?" },
  ],
  5,
);
for (const r of results) {
  console.log(r.result);
}
```

```ts
// Use an id to easily identify each request in the results.
const { results, errors } = await askAIPool(
  [
    { id: "france", prompt: "What is the capital of France?" },
    { id: "germany", prompt: "What is the capital of Germany?" },
  ],
  2,
);
for (const r of results) {
  console.log(r.request.id, r.result);
}
```

```ts
// Enable progress logging and retries.
const { results, errors } = await askAIPool(
  [
    {
      prompt: "Summarize this article.",
      options: { text: "./article1.txt", returnJson: true },
    },
    {
      prompt: "Summarize this article.",
      options: { text: "./article2.txt", returnJson: true },
    },
  ],
  3,
  {
    logProgress: true,
    retry: 2,
  },
);
console.log(`${results.length} succeeded, ${errors.length} failed`);
```

```ts
// Track cumulative metrics and enforce a minimum request duration to respect rate limits.
const metrics = {
  totalCost: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalRequests: 0,
};
const { results } = await askAIPool(
  [
    { prompt: "What is 2+2?" },
    { prompt: "What is 3+3?" },
  ],
  2,
  {
    minRequestDurationMs: 1000,
    metrics,
  },
);
console.log("Total cost:", metrics.totalCost);
console.log("Total requests:", metrics.totalRequests);
```

```ts
// Use retryCheck to only retry on specific errors.
const { results, errors } = await askAIPool(
  [
    {
      prompt: "Analyze this image.",
      options: { image: "./photo.jpg", returnJson: true },
    },
  ],
  1,
  {
    retry: 3,
    retryCheck: (error) => {
      // Only retry on rate limit errors
      return error instanceof Error && error.message.includes("429");
    },
  },
);
```

```ts
// Use schemaJson to enforce structured output with a specific schema.
import * as z from "zod";

const schema = z.toJSONSchema(
  z.object({
    people: z.array(z.object({
      name: z.string(),
      age: z.number(),
      gender: z.enum(["man", "woman"]),
    })),
  }),
);

const { results, errors } = await askAIPool(
  [
    {
      prompt: "Give me 5 characters from Harry Potter.",
      options: { schemaJson: schema },
    },
    {
      prompt: "Give me 5 characters from Lord of the Rings.",
      options: { schemaJson: schema },
    },
  ],
  2,
);
// Each result will conform to the specified schema
for (const r of results) {
  console.log(r.result); // { people: [{ name: "...", age: ..., gender: "..." }, ...] }
}
```

## askGemini

Interacts with Google's Gemini models to perform a wide range of tasks, from
answering questions to analysing multimedia content.

**Authentication**: set `AI_KEY` (API key) or `AI_PROJECT` + `AI_LOCATION`
(Vertex AI) environment variables, or pass credentials directly via options.

**Caching**: set `cache: true` to persist responses in `.journalism-cache`.

**File handling**: local paths and `gs://` GCS URLs are both supported for
images, audio, video, PDF, and text.

**Web Search Grounding**: set `webSearch: true` to let the model search the web
in real time (extra API cost).

Temperature defaults to 0 for deterministic responses. Safety filters are on by
default (`true`) but off when using Vertex AI (`false`); override with
`safetyEnabled`.

### Signature

```typescript
async function askGemini(
  prompt: string,
  options: {
    systemPrompt?: string;
    model?: string;
    apiKey?: string;
    vertex?: boolean;
    project?: string;
    location?: string;
    webSearch?: boolean;
    HTMLFrom?: string | string[];
    screenshotFrom?: string | string[];
    image?: string | string[];
    video?: string | string[];
    audio?: string | string[];
    pdf?: string | string[];
    text?: string | string[];
    returnJson?: boolean;
    parseJson?: boolean;
    schemaJson?: unknown;
    verbose?: boolean;
    cache?: boolean;
    test?: ((response: unknown) => void) | ((response: unknown) => void)[];
    clean?: (response: unknown) => unknown;
    thinkingBudget?: number;
    thinkingLevel?: "minimal" | "low" | "medium" | "high";
    includeThoughts?: boolean;
    temperature?: number;
    safetyEnabled?: boolean;
    detailedResponse: true;
    geminiParameters?: any;
    metrics?: {
      totalCost: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalRequests: number;
    };
  },
): Promise<GeminiDetailedResponse>;
```

### Parameters

- **`prompt`**: The primary text prompt.
- **`options.systemPrompt`**: Optional system prompt.
- **`options.model`**: Model name; defaults to `AI_MODEL` env var.
- **`options.apiKey`**: API key; defaults to `AI_KEY` env var.
- **`options.vertex`**: Use Vertex AI authentication.
- **`options.project`**: GCP project ID; defaults to `AI_PROJECT` env var.
- **`options.location`**: GCP location; defaults to `AI_LOCATION` env var.
- **`options.webSearch`**: Enable web search grounding (extra cost).
- **`options.HTMLFrom`**: URL(s) whose body HTML is appended to the prompt.
- **`options.image`**: Path(s) or `gs://` URL(s) to image files.
- **`options.video`**: Path(s) or `gs://` URL(s) to video files.
- **`options.audio`**: Path(s) or `gs://` URL(s) to audio files.
- **`options.pdf`**: Path(s) or `gs://` URL(s) to PDF files.
- **`options.text`**: Path(s) or `gs://` URL(s) to text files.
- **`options.returnJson`**: Ask the model to return JSON.
- **`options.parseJson`**: Auto-parse the JSON response.
- **`options.schemaJson`**: Zod JSON schema for structured output.
- **`options.cache`**: Cache the response in `.journalism-cache`.
- **`options.verbose`**: Log prompt, response, and token usage.
- **`options.clean`**: Transform the response before returning.
- **`options.test`**: Assert on the response (throws on failure).
- **`options.thinkingBudget`**: Reasoning token budget (0 = off, -1 = dynamic).
- **`options.thinkingLevel`**: Thinking level: "minimal" | "low" | "medium" |
  "high".
- **`options.includeThoughts`**: Include reasoning thoughts in output.
- **`options.temperature`**: Sampling temperature (default 0).
- **`options.safetyEnabled`**: Override safety filter defaults.
- **`options.detailedResponse`**: Return metadata alongside the response.
- **`options.geminiParameters`**: Extra params merged into
  `generateContentStream`.
- **`options.metrics`**: Cumulative metrics object updated after each call.

### Examples

```ts
const capital = await askGemini("What is the capital of France?");
console.log(capital); // "Paris"
```

```ts
// Pass credentials directly.
const response = await askGemini("What is the capital of France?", {
  apiKey: "your_api_key",
  model: "gemini-2.5-flash",
});

// Vertex AI.
const vertexResponse = await askGemini("What is the capital of France?", {
  vertex: true,
  project: "your_project_id",
  location: "us-central1",
});
```

```ts
// Web search grounding.
const factCheck = await askGemini(
  `Verify: "Renewable energy now accounts for over 30% of global electricity generation."`,
  { webSearch: true },
);
```

```ts
// Structured JSON output with a Zod schema.
import * as z from "zod";
const schema = z.toJSONSchema(
  z.array(z.object({ name: z.string(), age: z.number() })),
);
await askGemini("Give me 10 random people.", {
  schemaJson: schema,
  verbose: true,
});
```

```ts
// Analyse a local image.
const info = await askGemini("Describe this image.", {
  image: "./photo.jpg",
  returnJson: true,
});
```

```ts
// Detailed response with token usage and estimated cost.
const result = await askGemini("What is the capital of France?", {
  detailedResponse: true,
});
console.log(`${result.totalTokens} tokens, $${result.estimatedCost}`);
```

## askOllama

Interacts with a local Ollama model to perform a wide range of tasks.

Ollama must be running on the machine. Set the `AI_MODEL` environment variable
or pass `model` directly.

Pass a custom `Ollama` instance via the `ollama` option to target a non-default
host.

**Limitations vs Gemini**: audio, video, and PDF are not supported. GCS
(`gs://`) URLs are not supported — use local file paths only.

**Caching**: set `cache: true` to persist responses in `.journalism-cache`.

Temperature defaults to 0 for deterministic responses.

### Signature

```typescript
async function askOllama(
  prompt: string,
  options: {
    systemPrompt?: string;
    model?: string;
    ollama?: any;
    HTMLFrom?: string | string[];
    image?: string | string[];
    text?: string | string[];
    returnJson?: boolean;
    parseJson?: boolean;
    schemaJson?: unknown;
    verbose?: boolean;
    cache?: boolean;
    test?: ((response: unknown) => void) | ((response: unknown) => void)[];
    clean?: (response: unknown) => unknown;
    contextWindow?: number;
    thinkingBudget?: number;
    thinkingLevel?: "minimal" | "low" | "medium" | "high";
    includeThoughts?: boolean;
    temperature?: number;
    detailedResponse: true;
    ollamaParameters?: any;
    metrics?: {
      totalCost: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalRequests: number;
    };
  },
): Promise<OllamaDetailedResponse>;
```

### Parameters

- **`prompt`**: The primary text prompt.
- **`options.model`**: Model name; defaults to `AI_MODEL` env var.
- **`options.ollama`**: Custom `Ollama` instance targeting a specific host.
- **`options.systemPrompt`**: Optional system prompt.
- **`options.HTMLFrom`**: URL(s) whose body HTML is appended to the prompt.
- **`options.image`**: Local path(s) to image files.
- **`options.text`**: Local path(s) to text files.
- **`options.returnJson`**: Ask the model to return JSON.
- **`options.parseJson`**: Auto-parse the JSON response.
- **`options.schemaJson`**: JSON schema for structured output.
- **`options.cache`**: Cache the response in `.journalism-cache`.
- **`options.verbose`**: Log prompt, response, and token usage.
- **`options.clean`**: Transform the response before returning.
- **`options.test`**: Assert on the response (throws on failure).
- **`options.contextWindow`**: Override the model's context window size.
- **`options.thinkingBudget`**: Any non-zero value enables reasoning.
- **`options.thinkingLevel`**: Any value enables reasoning.
- **`options.includeThoughts`**: Include reasoning thoughts in output.
- **`options.temperature`**: Sampling temperature (default 0).
- **`options.detailedResponse`**: Return metadata alongside the response.
- **`options.ollamaParameters`**: Extra params merged into `client.chat`.
- **`options.metrics`**: Cumulative metrics object updated after each call.

### Examples

```ts
// Assumes OLLAMA=true and AI_MODEL are set in environment variables.
const capital = await askOllama("What is the capital of France?");
console.log(capital); // "Paris"
```

```ts
// Use a custom Ollama instance.
import { Ollama } from "ollama";
const client = new Ollama({ host: "http://127.0.0.1:11434" });
const result = await askOllama("What is the capital of France?", {
  ollama: client,
});
```

```ts
// Structured JSON output.
const result = await askOllama(
  "What is the capital of France? Return JSON: {country: string, capital: string}",
  { returnJson: true, verbose: true },
);
```

```ts
// Enable thinking / reasoning.
const result = await askOllama(
  "What is 17 * 23?",
  { thinkingBudget: 1, verbose: true },
);
```

```ts
// Detailed response with token usage.
const result = await askOllama("What is the capital of France?", {
  detailedResponse: true,
});
console.log(`${result.totalTokens} tokens in ${result.durationMs}ms`);
```

## getEmbedding

Generates a numerical embedding (vector representation) for a given text string.
Embeddings are crucial for various natural language processing (NLP) tasks,
including semantic search, text classification, clustering, and anomaly
detection, as they allow text to be processed and compared mathematically.

This function supports both Google's Gemini AI models and local models running
with Ollama. It provides options for authentication, model selection, and
caching to optimize performance and cost.

**Authentication**: Credentials and model information can be provided via
environment variables (`AI_KEY`, `AI_PROJECT`, `AI_LOCATION`,
`AI_EMBEDDINGS_MODEL`) or directly through the `options` object. Options take
precedence over environment variables.

**Local Models**: To use a local model with Ollama, set the `OLLAMA` environment
variable to `true` and ensure Ollama is running on your machine. You will also
need to specify the model name using the `AI_EMBEDDINGS_MODEL` environment
variable or the `model` option. If you want your Ollama instance to be used, you
can pass an instance of the `Ollama` class as the `ollama` option.

**Caching**: To save resources and time, you can enable caching by setting
`cache` to `true`. Responses will be stored in a local `.journalism-cache`
directory. If the same request is made again, the cached response will be
returned, avoiding redundant API calls. Remember to add `.journalism-cache` to
your `.gitignore` file.

### Signature

```typescript
async function getEmbedding(
  text: string,
  options?: {
    model?: string;
    apiKey?: string;
    vertex?: boolean;
    project?: string;
    location?: string;
    cache?: boolean;
    ollama?: boolean | any;
    verbose?: boolean;
    contextWindow?: number;
  },
): Promise<number[]>;
```

### Parameters

- **`text`**: The input text string for which to generate the embedding.
- **`options`**: Configuration options for the embedding generation.
- **`options.model`**: The specific embedding model to use (e.g.,
  'text-embedding-004'). Defaults to the `AI_EMBEDDINGS_MODEL` environment
  variable.
- **`options.apiKey`**: Your API key for authentication with Google Gemini.
  Defaults to the `AI_KEY` environment variable.
- **`options.vertex`**: If `true`, uses Vertex AI for authentication. Defaults
  to `false`.
- **`options.project`**: Your Google Cloud project ID for Vertex AI. Defaults to
  the `AI_PROJECT` environment variable.
- **`options.location`**: The Google Cloud location for your Vertex AI project.
  Defaults to the `AI_LOCATION` environment variable.
- **`options.cache`**: If `true`, enables caching of the embedding response.
  Defaults to `false`.
- **`options.ollama`**: If `true`, uses Ollama for local embedding generation.
  Defaults to the `OLLAMA` environment variable. If you want your Ollama
  instance to be used, you can pass it here too.
- **`options.verbose`**: If `true`, logs additional information such as
  execution time and the truncated input text. Defaults to `false`.
- **`options.contextWindow`**: An option to specify the context window size for
  Ollama models. By default, Ollama sets this depending on the model, which can
  be lower than the actual maximum context window size of the model.

### Returns

A promise that resolves to an an array of numbers representing the generated
embedding.

### Examples

```ts
// Basic usage: Generate an embedding for a simple text.
const embedding = await getEmbedding(
  "The quick brown fox jumps over the lazy dog.",
);
console.log(embedding); // [0.012, -0.034, ..., 0.056] (example output)
```

```ts
// Generate an embedding with caching enabled.
const cachedEmbedding = await getEmbedding(
  "Artificial intelligence is transforming industries.",
  { cache: true },
);
console.log(cachedEmbedding);
```

```ts
// Generate an embedding using a specific model and API key.
const customEmbedding = await getEmbedding(
  "Machine learning is a subset of AI.",
  {
    model: "another-embedding-model",
    apiKey: "your_custom_api_key",
  },
);
console.log(customEmbedding);
```

```ts
// Generate an embedding with verbose logging.
const verboseEmbedding = await getEmbedding(
  "The quick brown fox jumps over the lazy dog.",
  { verbose: true },
);
console.log(verboseEmbedding);
```
