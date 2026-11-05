export type Provider = "openai" | "anthropic" | "gemini" | "google-agent-platform" | "ollama";

/** Requires explicit provider selection; credentials never determine routing. */
export function resolveProvider(value: unknown): Provider {
  if (
    value === "openai" ||
    value === "anthropic" ||
    value === "gemini" ||
    value === "google-agent-platform" ||
    value === "ollama"
  )
    return value;
  throw new Error(
    "Set AI_PROVIDER to openai, anthropic, gemini, google-agent-platform, or ollama.",
  );
}

/** Validates a non-secret deployment endpoint. */
export function providerEndpoint(value: string): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "baseURL must be an HTTP(S) URL without credentials, query parameters, or fragments.",
    );
  }
  return url.href.replace(/\/$/, "");
}

/** Resolves shared credentials and deployment settings without loading a provider SDK. */
export function providerDeployment(
  provider: Provider,
  options: { apiKey?: string; project?: string; location?: string; baseURL?: string },
  environment: Record<string, string | undefined> = process.env,
): {
  apiKey?: string;
  project?: string;
  location?: string;
  endpoint: string;
  authentication: "api-key" | "adc" | "none";
} {
  if (
    provider !== "google-agent-platform" &&
    (options.project !== undefined || options.location !== undefined)
  )
    throw new Error("project and location require google-agent-platform.");
  const endpoint = options.baseURL === undefined ? undefined : providerEndpoint(options.baseURL);
  if (provider === "ollama")
    return {
      endpoint: endpoint ?? providerEndpoint(environment.OLLAMA_HOST ?? "http://127.0.0.1:11434"),
      authentication: "none",
    };
  const apiKey = options.apiKey ?? environment.AI_KEY;
  if (provider === "google-agent-platform") {
    const project = options.project ?? environment.AI_PROJECT;
    const location = options.location ?? environment.AI_LOCATION ?? "global";
    if (!apiKey && !project)
      throw new Error(
        "Set AI_PROJECT or pass project for Google Agent Platform application credentials.",
      );
    if (!/^[a-zA-Z0-9-]+$/.test(location))
      throw new Error("Invalid Google Agent Platform location.");
    if (project !== undefined && !/^[a-zA-Z0-9._:-]+$/.test(project))
      throw new Error("Invalid Google Agent Platform project.");
    const host =
      location === "global"
        ? "aiplatform.googleapis.com"
        : location === "eu" || location === "us"
          ? `aiplatform.${location}.rep.googleapis.com`
          : `${location}-aiplatform.googleapis.com`;
    const url = apiKey
      ? "https://aiplatform.googleapis.com/v1/publishers/google"
      : `https://${host}/v1beta1/projects/${project ?? ""}/locations/${location}/publishers/google`;
    return {
      apiKey,
      project,
      location,
      endpoint: endpoint ?? url,
      authentication: apiKey ? "api-key" : "adc",
    };
  }
  const urls = {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta",
  };
  return { apiKey, endpoint: endpoint ?? urls[provider], authentication: "api-key" };
}

/** Checks authentication configuration immediately before an uncached provider call. */
export function requireCredentials(deployment: ReturnType<typeof providerDeployment>): void {
  if (deployment.authentication === "api-key" && !deployment.apiKey?.trim())
    throw new Error("Set AI_KEY or pass apiKey for the selected provider.");
  if (deployment.authentication === "adc" && !deployment.project)
    throw new Error(
      "Set AI_PROJECT or pass project for Google Agent Platform application credentials.",
    );
}
