import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";

export const hadithInputSchema = z.object({
  text: z.string().trim().min(12, "أدخل نصاً أوضح للحديث.").max(6000, "النص طويل جداً؛ يرجى الاكتفاء بمتن الحديث."),
});

const sourceSchema = z.object({
  book: z.string().min(1),
  reference: z.string().min(1),
  note: z.string().min(1),
});

const scholarSchema = z.object({
  scholar: z.string().min(1),
  opinion: z.string().min(1),
  conclusion: z.string().min(1),
});

const narratorVerdicts = ["ثقة", "صدوق", "لين الحديث", "ضعيف", "متروك", "مختلف فيه", "غير محرر"] as const;

const narratorOpinionSchema = z.object({
  scholar: z.string().min(1),
  statement: z.string().min(1),
  verdict: z.enum(narratorVerdicts),
  book: z.string(),
  reference: z.string(),
  documented: z.boolean(),
});

const narratorSchema = z.object({
  name: z.string().min(1),
  tabaqah: z.string(),
  role: z.string(),
  opinions: z.array(narratorOpinionSchema),
});

const tariqSchema = z.object({
  label: z.string().min(1),
  grade: z.string(),
  note: z.string(),
  narrators: z.array(narratorSchema),
});

export const hadithAnalysisSchema = z.object({
  matn: z.string().min(1),
  grade: z.enum(["صحيح", "حسن", "ضعيف", "موضوع", "مختلف فيه"]),
  gradeType: z.string().min(1),
  summary: z.string().min(1),
  confidenceNote: z.string().min(1),
  sources: z.array(sourceSchema),
  isnadStudy: z.array(z.string()),
  matnStudy: z.array(z.string()),
  scholars: z.array(scholarSchema),
  turuq: z.array(tariqSchema),
  caution: z.string().min(1),
});

const responseSchema = {
  type: "object",
  properties: {
    matn: { type: "string" },
    grade: { type: "string", enum: ["صحيح", "حسن", "ضعيف", "موضوع", "مختلف فيه"] },
    gradeType: { type: "string" },
    summary: { type: "string" },
    confidenceNote: { type: "string" },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: { book: { type: "string" }, reference: { type: "string" }, note: { type: "string" } },
        required: ["book", "reference", "note"],
        additionalProperties: false,
      },
    },
    isnadStudy: { type: "array", items: { type: "string" } },
    matnStudy: { type: "array", items: { type: "string" } },
    scholars: {
      type: "array",
      items: {
        type: "object",
        properties: { scholar: { type: "string" }, opinion: { type: "string" }, conclusion: { type: "string" } },
        required: ["scholar", "opinion", "conclusion"],
        additionalProperties: false,
      },
    },
    turuq: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          grade: { type: "string" },
          note: { type: "string" },
          narrators: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                tabaqah: { type: "string" },
                role: { type: "string" },
                opinions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      scholar: { type: "string" },
                      statement: { type: "string" },
                      verdict: { type: "string", enum: ["ثقة", "صدوق", "لين الحديث", "ضعيف", "متروك", "مختلف فيه", "غير محرر"] },
                      book: { type: "string" },
                      reference: { type: "string" },
                      documented: { type: "boolean" },
                    },
                    required: ["scholar", "statement", "verdict", "book", "reference", "documented"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["name", "tabaqah", "role", "opinions"],
              additionalProperties: false,
            },
          },
        },
        required: ["label", "grade", "note", "narrators"],
        additionalProperties: false,
      },
    },
    caution: { type: "string" },
  },
  required: ["matn", "grade", "gradeType", "summary", "confidenceNote", "sources", "isnadStudy", "matnStudy", "scholars", "turuq", "caution"],
  additionalProperties: false,
} as const;

export const SUNNI_HADITH_SYSTEM_PROMPT = `أنت مساعد بحثي متخصص في تخريج الأحاديث، وتكتب بالعربية الفصحى فقط. التزم بمنهج أهل السنة والجماعة في علوم الحديث: اعرض الحكم المنقول من أئمة النقد والمحققين المعتمدين عند الإمكان، وميّز بين الحديث الصحيح والحسن والضعيف والموضوع والمختلف فيه. لا تُنشئ مراجع أو أرقام أحاديث أو أقوالاً منسوبة إلى الأئمة إن لم تكن متيقناً منها. لا تجعل تشابه اللفظ دليلاً على صحة الحديث. افصل بين ثبوت الإسناد ونقد المتن، واذكر الخلاف المعتبر بلا ترجيح متكلّف. إذا كان النص غير كافٍ أو لم تستطع التثبت من موضعه، فاختر «مختلف فيه» أو «ضعيف» بحسب الظاهر، وصرّح بحدود النتيجة في confidenceNote وcaution. لا تصدر فتوى ولا تدّعِ أن هذه النتيجة تغني عن الرجوع إلى المصادر والمختصين. أعد JSON فقط مطابقاً للمخطط؛ اجعل المصادر وأقوال الأئمة مصفوفات فارغة عند غياب التوثيق بدلاً من اختلاق معلومات.

لحقل turuq: اذكر كل طريق معروف ومشهور روي به الحديث (لا تقتصر على طريق واحد إن كان له أكثر من طريق مشهورة)، مع تسمية كل طريق بمن دار عليه الإسناد (مثل: «طريق مالك عن نافع عن ابن عمر»)، وحكم أهل العلم على ذلك الطريق تحديداً في حقل grade. لكل راوٍ في السند اذكر اسمه وطبقته (صحابي/تابعي/تابع تابعي/من بعدهم) وموضعه في السند. لكل قول جرح أو تعديل في راوٍ: انسبه لناقد معيّن بعينه (كابن معين أو أحمد أو ابن حجر أو الذهبي) واذكر درجة القول في verdict، واجعل documented=true فقط إذا كنت متيقناً من اسم الكتاب وموضع القول فيه فتذكرهما في book وreference بدقة؛ وإلا فاجعل documented=false واترك book وreference فارغين ولا تخترع رقم صفحة أو مجلد. إن لم تكن واثقاً من تفاصيل طريق أو راوٍ فاحذفه من المصفوفة بدلاً من تخمينه. هذه البيانات تُعرض للباحث كمسودة للمراجعة البشرية وليست حكماً نهائياً.`;

export async function analyzeHadith(text: string) {
  try {
    const response = await invokeLLM({
      model: "gpt-5",
      maxCompletionTokens: 6000,
      reasoning: { effort: "medium" },
      messages: [
        { role: "system", content: SUNNI_HADITH_SYSTEM_PROMPT },
        { role: "user", content: `حلّل هذا النص على أنه متن حديث أو جزء منه، ثم أعِد النتيجة المنظمة فقط:\n\n${text}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "hadith_analysis", strict: true, schema: responseSchema },
      },
    });

    const content = response.choices[0]?.message.content;
    if (typeof content !== "string") {
      throw new Error("لم تُستلم استجابة نصية قابلة للمعالجة");
    }
    return hadithAnalysisSchema.parse(JSON.parse(content));
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "تعذّر فهم النص أو تنظيم نتيجته. جرّب إدخال متن أوضح." });
    }
    if (error instanceof TRPCError) throw error;
    console.error("[Hadith analysis] failed", error);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذّر إتمام الفحص الآن. تحقّق من الاتصال ثم حاول مرة أخرى." });
  }
}
