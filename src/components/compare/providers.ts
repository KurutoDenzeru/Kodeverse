// Provider identities for the model catalogue. The vendor pages name models,
// not makers, so the provider is read off the model name: one prefix map, the
// first match wins, and anything unmapped renders as a neutral letter tile.
// GLM and ZCode models carry the Z.ai mark: Zhipu AI's own logo, not the old
// ChatGLM knot, which reads as Meta's.

export interface Provider {
  id: string;
  label: string;
}

/** The providers the sprite carries, in marquee order. */
export const PROVIDERS: Provider[] = [
  { id: "anthropic", label: "Anthropic" },
  { id: "openai", label: "OpenAI" },
  { id: "gemini", label: "Gemini" },
  { id: "grok", label: "Grok" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "zhipu", label: "Zhipu AI" },
  { id: "moonshot", label: "Moonshot" },
  { id: "qwen", label: "Qwen" },
  { id: "minimax", label: "MiniMax" },
  { id: "meta", label: "Meta" },
  { id: "xiaomi", label: "Xiaomi" },
  { id: "mistral", label: "Mistral" },
  { id: "nvidia", label: "NVIDIA" },
  { id: "hunyuan", label: "Hunyuan" },
  { id: "longcat", label: "LongCat" },
  { id: "stepfun", label: "StepFun" },
];

const RULES: [RegExp, string][] = [
  [/^claude/i, "anthropic"],
  [/^gpt/i, "openai"],
  [/^gemini/i, "gemini"],
  [/^grok/i, "grok"],
  [/^deepseek/i, "deepseek"],
  [/^glm/i, "zhipu"],
  [/^kimi/i, "moonshot"],
  [/^qwen/i, "qwen"],
  [/^minimax/i, "minimax"],
  [/^mimo/i, "xiaomi"],
  [/^muse/i, "meta"],
  [/^mistral/i, "mistral"],
  [/^nemotron/i, "nvidia"],
  [/^hy\d/i, "hunyuan"],
  [/^longcat/i, "longcat"],
  [/^step/i, "stepfun"],
];

/** The provider a model belongs to, or null when the catalogue names no maker. */
export const providerOf = (name: string): string | null =>
  RULES.find(([re]) => re.test(name))?.[1] ?? null;
