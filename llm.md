# API Reference

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

### Signature

```typescript
async function askAI(
  prompt: string,
  options?: {
    model?: string;
    apiKey?: string;
    vertex?: boolean;
    project?: string;
    location?: string;
    ollama?: boolean | Ollama;
    HTMLFrom?: string | string[];
    screenshotFrom?: string | string[];
    image?: string | string[];
    video?: string | string[];
    audio?: string | string[];
    pdf?: string | string[];
    text?: string | string[];
    returnJson?: boolean;
    parseJson?: boolean;
    verbose?: boolean;
    cache?: boolean;
    test?: ((response: unknown) => void) | ((response: unknown) => void)[];
    clean?: (response: unknown) => unknown;
    contextWindow?: number;
    thinkingBudget?: number;
    includeThoughts?: boolean;
    metrics?: {
      totalCost: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalRequests: number;
    };
  },
): Promise<unknown>;
```

### Parameters

- **`prompt`**: - The primary text input for the AI model.
- **`options`**: - A comprehensive set of options.
- **`options.model`**: - The specific AI model to use (e.g.,
  'gemini-1.5-flash'). Defaults to the `AI_MODEL` environment variable.
- **`options.apiKey`**: - Your API key for the AI service. Defaults to the
  `AI_KEY` environment variable.
- **`options.vertex`**: - Set to `true` to use Vertex AI for authentication.
  Auto-enables if `AI_PROJECT` and `AI_LOCATION` are set.
- **`options.project`**: - Your Google Cloud project ID. Defaults to the
  `AI_PROJECT` environment variable.
- **`options.location`**: - The Google Cloud location for your project. Defaults
  to the `AI_LOCATION` environment variable.
- **`options.ollama`**: - Set to `true` to use a local Ollama model. Defaults to
  the `OLLAMA` environment variable. If you want your Ollama instance to be
  used, you can pass it here too.
- **`options.HTMLFrom`**: - A URL or an array of URLs to scrape HTML content
  from. The content is appended to the prompt.
- **`options.screenshotFrom`**: - A URL or an array of URLs to take a screenshot
  from for analysis.
- **`options.image`**: - A path or GCS URL (or an array of them) to an image
  file.
- **`options.video`**: - A path or GCS URL (or an array of them) to a video
  file.
- **`options.audio`**: - A path or GCS URL (or an array of them) to an audio
  file.
- **`options.pdf`**: - A path or GCS URL (or an array of them) to a PDF file.
- **`options.text`**: - A path or GCS URL (or an array of them) to a text file.
- **`options.returnJson`**: - If `true`, instructs the AI to return a JSON
  object. Defaults to `false`.
- **`options.parseJson`**: - If `true`, automatically parses the AI's response
  as JSON. Defaults to `true` if `returnJson` is `true`, otherwise `false`.
- **`options.cache`**: - If `true`, caches the response locally in a
  `.journalism-cache` directory. Defaults to `false`.
- **`options.verbose`**: - If `true`, enables detailed logging, including token
  usage and estimated costs. Defaults to `false`.
- **`options.clean`**: - A function to process and clean the AI's response
  before it is returned or tested. This function is called after JSON parsing
  (if `parseJson` is `true`). The response parameter will be the parsed JSON
  object if `parseJson` is true, or a string otherwise.
- **`options.test`**: - A function or an array of functions to validate the AI's
  response before it's returned.
- **`options.contextWindow`**: - An option to specify the context window size
  for Ollama models. By default, Ollama sets this depending on the model, which
  can be lower than the actual maximum context window size of the model.
- **`options.thinkingBudget`**: - Sets the reasoning token budget: 0 to disable
  (default, though some models may reason regardless), -1 for a dynamic budget,
  or > 0 for a fixed budget. For Ollama models, any non-zero value simply
  enables reasoning, ignoring the specific budget amount.
- **`options.includeThoughts`**: - If `true`, includes the AI's reasoning
  thoughts in the output when using a thinking budget. Defaults to `false`.
- **`options.metrics`**: - An object to track cumulative metrics across multiple
  AI requests. Pass an object with `totalCost`, `totalInputTokens`,
  `totalOutputTokens`, and `totalRequests` properties (all initialized to 0).
  The function will update these values after each request. Note: `totalCost` is
  only calculated for Google GenAI models, not for Ollama.

### Returns

A Promise that resolves to the AI's response.

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
// Scrape and analyze HTML content from a URL.
const orders = await askAI(
  `From the following HTML, extract the executive order titles, their dates (in yyyy-mm-dd format), and their URLs. Return the data as a JSON array of objects.`,
  {
    HTMLFrom:
      "https://www.whitehouse.gov/presidential-actions/executive-orders/",
    returnJson: true,
  },
);
console.table(orders);

// Analyze a screenshot of a webpage.
const specials = await askAI(
  `Based on this screenshot of a grocery store flyer, list the products that are on special.`,
  {
    screenshotFrom: "https://www.metro.ca/circulaire",
    returnJson: true,
  },
);
console.table(specials);
```

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
```

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
    ollama?: boolean | Ollama;
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
- **`options.contextWindow`**: - An option to specify the context window size
  for Ollama models. By default, Ollama sets this depending on the model, which
  can be lower than the actual maximum context window size of the model.

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
