
import test from "node:test";
import assert from "node:assert/strict";
import { generateOpenAIText } from "./openai";

interface OpenAIRequestBody {
  model?: string;
  input?: string;
  max_output_tokens?: number;
}

test("OpenAI helper rejects missing API configuration", async () => {
  await assert.rejects(
    generateOpenAIText({}, "Hello"),
    /OpenAI is not configured/,
  );
});

test("OpenAI helper rejects a blank API key", async () => {
  await assert.rejects(
    generateOpenAIText({ OPENAI_API_KEY: "   " }, "Hello"),
    /OpenAI is not configured/,
  );
});

test("OpenAI helper calls Responses API and extracts output text", async () => {
  let requestedUrl = "";
  let requestedBody: OpenAIRequestBody = {};
  let authorization = "";

  const result = await generateOpenAIText(
    { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "gpt-6-luna" },
    "Parse this sourcing brief",
    async (input, init) => {
      requestedUrl = String(input);
      requestedBody = JSON.parse(String(init?.body));
      authorization = new Headers(init?.headers).get("Authorization") ?? "";

      return Response.json({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Parsed brief" }],
          },
        ],
      });
    },
  );

  assert.equal(requestedUrl, "https://api.openai.com/v1/responses");
  assert.equal(authorization, "Bearer test-key");
  assert.equal(requestedBody.model, "gpt-6-luna");
  assert.equal(requestedBody.input, "Parse this sourcing brief");
  assert.equal(requestedBody.max_output_tokens, 1200);
  assert.equal(result, "Parsed brief");
});

test("OpenAI helper uses the default model when none is configured", async () => {
  let requestedBody: OpenAIRequestBody = {};

  await generateOpenAIText(
    { OPENAI_API_KEY: "test-key" },
    "Hello",
    async (_input, init) => {
      requestedBody = JSON.parse(String(init?.body));
      return Response.json({ output_text: "Hello there" });
    },
  );

  assert.equal(requestedBody.model, "gpt-6-luna");
});

test("OpenAI helper trims the configured model name", async () => {
  let requestedBody: OpenAIRequestBody = {};

  await generateOpenAIText(
    { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "  gpt-6-luna  " },
    "Hello",
    async (_input, init) => {
      requestedBody = JSON.parse(String(init?.body));
      return Response.json({ output_text: "Hello there" });
    },
  );

  assert.equal(requestedBody.model, "gpt-6-luna");
});

test("OpenAI helper supports the top-level output_text shortcut", async () => {
  const result = await generateOpenAIText(
    { OPENAI_API_KEY: "test-key" },
    "Write a short description",
    async () => Response.json({ output_text: "Improved description" }),
  );

  assert.equal(result, "Improved description");
});

test("OpenAI helper reports upstream failures without exposing response bodies", async () => {
  await assert.rejects(
    generateOpenAIText(
      { OPENAI_API_KEY: "test-key" },
      "Hello",
      async () => new Response("private provider detail", { status: 429 }),
    ),
    /status 429/,
  );
});

test("OpenAI helper rejects empty model output", async () => {
  await assert.rejects(
    generateOpenAIText(
      { OPENAI_API_KEY: "test-key" },
      "Hello",
      async () => Response.json({ output: [] }),
    ),
    /no text output/,
  );
});
