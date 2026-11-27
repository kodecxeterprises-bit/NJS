
export interface OpenAIEnv {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
}

interface OpenAIResponseContent {
  type?: string;
  text?: string;
}

interface OpenAIResponseOutput {
  type?: string;
  content?: OpenAIResponseContent[];
}

interface OpenAIResponse {
  output_text?: string;
  output?: OpenAIResponseOutput[];
}

export async function generateOpenAIText(
  env: OpenAIEnv,
  input: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  if (!env.OPENAI_API_KEY?.trim()) {
    throw new Error("OpenAI is not configured.");
  }

  const model = env.OPENAI_MODEL?.trim() || "gpt-6-luna";

  const response = await fetcher(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input,
        max_output_tokens: 1200,
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    throw new Error(
      `OpenAI API request failed with status ${response.status}.`,
    );
  }

  const data = (await response.json()) as OpenAIResponse;

  const outputText = data.output_text?.trim();

  const extractedText =
    outputText ||
    data.output
      ?.flatMap((item) => item.content ?? [])
      .filter(
        (item) =>
          item.type === "output_text" &&
          typeof item.text === "string",
      )
      .map((item) => item.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n") ||
    "";

  if (!extractedText) {
    throw new Error("OpenAI returned no text output.");
  }

  return extractedText;
}
 