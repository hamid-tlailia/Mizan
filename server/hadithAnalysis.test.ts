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
  turuq: [
    {
      label: "طريق يحيى بن سعيد الأنصاري عن محمد بن إبراهيم التيمي عن علقمة بن وقاص عن عمر بن الخطاب",
      grade: "صحيح متفق عليه",
      note: "هذا الطريق هو المدار الذي اشتهر به الحديث عند أصحاب الكتب الستة.",
      narrators: [
        {
          name: "عمر بن الخطاب",
          tabaqah: "صحابي",
          role: "راوي الحديث عن النبي صلى الله عليه وسلم",
          opinions: [],
        },
        {
          name: "يحيى بن سعيد الأنصاري",
          tabaqah: "تابع تابعي",
          role: "المدار الذي دار عليه الإسناد",
          opinions: [
            {
              scholar: "ابن حجر العسقلاني",
              statement: "ثقة ثبت.",
              verdict: "ثقة",
              book: "تقريب التهذيب",
              reference: "ترجمة رقم 7550",
              documented: true,
            },
          ],
        },
      ],
    },
  ],
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

  it("يقبل طرق الحديث والرواة وأقوال الجرح والتعديل المنسوبة", () => {
    const parsed = hadithAnalysisSchema.parse(validAnalysis);
    expect(parsed.turuq).toHaveLength(1);
    expect(parsed.turuq[0].narrators[1].opinions[0].verdict).toBe("ثقة");
  });

  it("يرفض حكماً على راوٍ بغير درجة معتمدة", () => {
    const invalidVerdict = JSON.parse(JSON.stringify(validAnalysis));
    invalidVerdict.turuq[0].narrators[1].opinions[0].verdict = "قول غير معروف";
    expect(() => hadithAnalysisSchema.parse(invalidVerdict)).toThrow();
  });

  it("يقبل قول جرح وتعديل غير موثّق طالما تُرك حقلا الكتاب والموضع فارغين", () => {
    const undocumented = JSON.parse(JSON.stringify(validAnalysis));
    undocumented.turuq[0].narrators[1].opinions[0] = {
      scholar: "الذهبي",
      statement: "وثّقه جماعة.",
      verdict: "مختلف فيه",
      book: "",
      reference: "",
      documented: false,
    };
    expect(() => hadithAnalysisSchema.parse(undocumented)).not.toThrow();
  });
});
