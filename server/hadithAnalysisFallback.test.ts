import { describe, expect, it, vi } from "vitest";

const invokeLLMMock = vi.fn();

vi.mock("./_core/llm", async () => {
  const actual = await vi.importActual<typeof import("./_core/llm")>("./_core/llm");
  return { ...actual, invokeLLM: invokeLLMMock };
});
vi.mock("./_core/env", () => ({ ENV: { llmModels: ["model-a", "model-b"] } }));

const validContent = JSON.stringify({
  matn: "متن",
  grade: "صحيح",
  gradeType: "صحيح",
  summary: "ملخص",
  confidenceNote: "تنبيه",
  sources: [],
  isnadStudy: [],
  matnStudy: [],
  scholars: [],
  turuq: [],
  caution: "تنبيه",
});

const okResponse = { choices: [{ index: 0, message: { role: "assistant", content: validContent }, finish_reason: "stop" }] };

describe("التبديل بين نماذج الذكاء الاصطناعي عند نفاد الحصة", () => {
  it("ينتقل للنموذج التالي عند خطأ 429 ولا يفشل الطلب", async () => {
    const { LLMError } = await import("./_core/llm");
    invokeLLMMock.mockReset();
    invokeLLMMock.mockRejectedValueOnce(new LLMError(429, "quota exceeded"));
    invokeLLMMock.mockResolvedValueOnce(okResponse);

    const { analyzeHadith } = await import("./hadithAnalysis");
    const result = await analyzeHadith("إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ");

    expect(result.grade).toBe("صحيح");
    expect(invokeLLMMock).toHaveBeenCalledTimes(2);
    expect(invokeLLMMock.mock.calls[0][0].model).toBe("model-a");
    expect(invokeLLMMock.mock.calls[1][0].model).toBe("model-b");
  });

  it("لا ينتقل لنموذج آخر عند خطأ غير متعلق بالحصة، ويفشل فوراً", async () => {
    const { LLMError } = await import("./_core/llm");
    invokeLLMMock.mockReset();
    invokeLLMMock.mockRejectedValueOnce(new LLMError(400, "bad request"));

    const { analyzeHadith } = await import("./hadithAnalysis");
    await expect(analyzeHadith("إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ")).rejects.toThrow();
    expect(invokeLLMMock).toHaveBeenCalledTimes(1);
  });

  it("يطلب جهداً منخفضاً للسرعة، ويعيد المحاولة بنفس النموذج بلا reasoning_effort إن رفضه", async () => {
    const { LLMError } = await import("./_core/llm");
    invokeLLMMock.mockReset();
    invokeLLMMock.mockRejectedValueOnce(new LLMError(400, 'LLM invoke failed: 400 Bad Request – {\n  "error": {\n    "message": "Unknown parameter: \'reasoning_effort\'.",\n    "type": "invalid_request_error",\n    "param": "reasoning_effort",\n    "code": "unknown_parameter"\n  }\n}'));
    invokeLLMMock.mockResolvedValueOnce(okResponse);

    const { analyzeHadith } = await import("./hadithAnalysis");
    const result = await analyzeHadith("إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ");

    expect(result.grade).toBe("صحيح");
    expect(invokeLLMMock).toHaveBeenCalledTimes(2);
    expect(invokeLLMMock.mock.calls[0][0].model).toBe("model-a");
    expect(invokeLLMMock.mock.calls[0][0].reasoning_effort).toBe("low");
    expect(invokeLLMMock.mock.calls[1][0].model).toBe("model-a");
    expect(invokeLLMMock.mock.calls[1][0].reasoning_effort).toBeUndefined();
  });
});
