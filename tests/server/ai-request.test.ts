import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clientOptions: vi.fn(),
  parse: vi.fn(),
  zodTextFormat: vi.fn(() => ({ type: "json_schema" })),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    readonly responses = { parse: mocks.parse };

    constructor(options: unknown) {
      mocks.clientOptions(options);
    }
  },
}));

vi.mock("openai/helpers/zod", () => ({
  zodTextFormat: mocks.zodTextFormat,
}));

import { adjudicateItems } from "../../lib/server/ai";

const originalApiKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_MODEL;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "test-openai-key";
  delete process.env.OPENAI_MODEL;
  mocks.parse.mockResolvedValue({
    output_parsed: {
      results: [
        {
          itemId: "item-1",
          itemType: "QUESTION",
          verdict: "DUNG",
          finalCorrect: null,
          confidence: "HIGH",
          gmNote: "Khớp dữ kiện canon.",
        },
      ],
    },
  });
});

afterAll(() => {
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;

  if (originalModel === undefined) delete process.env.OPENAI_MODEL;
  else process.env.OPENAI_MODEL = originalModel;
});

describe("OpenAI adjudication request", () => {
  it("dùng Sol, reasoning medium và Structured Outputs an toàn", async () => {
    await adjudicateItems([
      {
        id: "item-1",
        caseId: "case-01",
        type: "QUESTION",
        content: "Anh ta dùng một khối băng đúng không?",
      },
    ]);

    expect(mocks.clientOptions).toHaveBeenCalledWith({
      apiKey: "test-openai-key",
      timeout: 20_000,
      maxRetries: 0,
    });
    expect(mocks.parse).toHaveBeenCalledOnce();
    expect(mocks.parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.6-sol",
        store: false,
        reasoning: { effort: "medium" },
        text: expect.objectContaining({
          format: { type: "json_schema" },
          verbosity: "low",
        }),
      }),
    );
    expect(mocks.zodTextFormat).toHaveBeenCalledOnce();
  });

  it("vẫn cho phép cấu hình model bằng biến môi trường", async () => {
    process.env.OPENAI_MODEL = "gpt-5.6-terra";

    const result = await adjudicateItems([
      {
        id: "item-1",
        caseId: "case-01",
        type: "QUESTION",
        content: "Anh ta dùng một khối băng đúng không?",
      },
    ]);

    expect(mocks.parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-5.6-terra" }),
    );
    expect(result.model).toBe("gpt-5.6-terra");
  });
});
