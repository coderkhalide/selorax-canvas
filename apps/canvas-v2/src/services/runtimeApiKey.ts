let openaiApiKey = "";
let geminiApiKey = "";

export const setRuntimeApiKey = (
  key: string,
  provider: "openai" | "gemini"
) => {
  if (provider === "openai") {
    openaiApiKey = key;
  } else {
    geminiApiKey = key;
  }
};

export const getRuntimeApiKey = (
  provider: "openai" | "gemini" = "gemini"
): string => {
  if (provider === "openai") {
    if (openaiApiKey) return openaiApiKey;
    if (typeof process !== "undefined") {
      const envKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
      if (envKey && typeof envKey === "string") return envKey;
    }
  } else {
    if (geminiApiKey) return geminiApiKey;
    if (typeof process !== "undefined") {
      const envKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (envKey && typeof envKey === "string") return envKey;
    }
  }
  return "";
};
