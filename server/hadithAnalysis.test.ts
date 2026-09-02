import { describe, expect, it } from "vitest";
import { hadithAnalysisSchema, hadithInputSchema } from "./hadithAnalysis";

const validAnalysis = {
  matn: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",
  grade: "صحيح",
  gradeType: "صحيح لذاته",
  summary: "حديث ثابت مشهور.",
  confidenceNote: "يلزم الرجوع إلى المصدر عند التوسع.",
  sources: [{ book: "صحيح البخاري", reference: "بدء الوحي", note: "رواه البخاري." }],
  isnadStudy: ["إسناده متصل."],
  matnStudy: ["متنه محفوظ."],
  scholars: [{ scholar: "البخاري", opinion: "أخرجه في صحيحه.", conclusion: "صحيح." }],
  caution: "هذه نتيجة مساعدة بحثية.",
};

describe("عقد تحليل الحديث", () => {
  it("يقبل الاستجابة المنظمة المكتملة", () => {
    expect(hadithAnalysisSchema.parse(validAnalysis).grade).toBe("صحيح");
  });

  it("يرفض النص القصير غير الواضح", () => {
    expect(() => hadithInputSchema.parse({ text: "قصير" })).toThrow();
  });

  it("يرفض الاستجابة التي تغفل الحقول البحثية اللازمة", () => {
    const incomplete = { ...validAnalysis } as Record<string, unknown>;
    delete incomplete.caution;
    expect(() => hadithAnalysisSchema.parse(incomplete)).toThrow();
  });
});
