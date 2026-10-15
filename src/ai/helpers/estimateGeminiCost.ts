/** Calculates the estimated standard, global Gemini cost in USD. */
export default function estimateGeminiCost(
  model: string,
  promptTokenCount: number,
  outputTokenCount: number,
  thoughtsTokenCount: number,
  hasAudio: boolean,
): number | null {
  const pricing = [
    { model: "gemini-3.7-flash", input: 0.75, output: 3.75 },
    { model: "gemini-3.6-flash", input: 0.75, output: 3.75 },
    { model: "gemini-3.5-flash", input: 1.5, output: 9.0 },
    { model: "gemini-3.5-flash-lite", input: 0.3, output: 2.5 },
    {
      model: "gemini-3.1-pro",
      tiers: [
        { threshold: 200_000, input: 2.0, output: 12.0 },
        { threshold: Infinity, input: 4.0, output: 18.0 },
      ],
    },
    {
      model: "gemini-3.1-flash",
      input: hasAudio ? 1.0 : 0.5,
      output: 3.0,
    },
    {
      model: "gemini-3.1-flash-lite",
      input: hasAudio ? 0.5 : 0.25,
      output: 1.5,
    },
    {
      model: "gemini-3-pro",
      tiers: [
        { threshold: 200_000, input: 2.0, output: 12.0 },
        { threshold: Infinity, input: 4.0, output: 18.0 },
      ],
    },
    { model: "gemini-3-flash", input: hasAudio ? 1.0 : 0.5, output: 3.0 },
  ];

  const modelPricing = pricing.find((p) => p.model === model.replace("-preview", ""));
  if (!modelPricing) return null;

  let inputRate: number;
  let outputRate: number;
  if ("tiers" in modelPricing && modelPricing.tiers) {
    const tier =
      modelPricing.tiers.find((t) => promptTokenCount <= t.threshold) ??
      modelPricing.tiers[modelPricing.tiers.length - 1];
    inputRate = tier.input;
    outputRate = tier.output;
  } else {
    inputRate = modelPricing.input;
    outputRate = modelPricing.output;
  }

  return (
    (promptTokenCount / 1_000_000) * inputRate +
    ((outputTokenCount + thoughtsTokenCount) / 1_000_000) * outputRate
  );
}
