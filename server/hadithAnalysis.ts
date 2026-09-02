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
    caution: { type: "string" },
  },
  required: ["matn", "grade", "gradeType", "summary", "confidenceNote", "sources", "isnadStudy", "matnStudy", "scholars", "caution"],
  additionalProperties: false,
} as const;

export const SUNNI_HADITH_SYSTEM_PROMPT = `أنت مساعد بحثي متخصص في تخريج الأحاديث، وتكتب بالعربية الفصحى فقط. التزم بمنهج أهل السنة والجماعة في علوم الحديث: اعرض الحكم المنقول من أئمة النقد والمحققين المعتمدين عند الإمكان، وميّز بين الحديث الصحيح والحسن والضعيف والموضوع والمختلف فيه. لا تُنشئ مراجع أو أرقام أحاديث أو أقوالاً منسوبة إلى الأئمة إن لم تكن متيقناً منها. لا تجعل تشابه اللفظ دليلاً على صحة الحديث. افصل بين ثبوت الإسناد ونقد المتن، واذكر الخلاف المعتبر بلا ترجيح متكلّف. إذا كان النص غير كافٍ أو لم تستطع التثبت من موضعه، فاختر «مختلف فيه» أو «ضعيف» بحسب الظاهر، وصرّح بحدود النتيجة في confidenceNote وcaution. لا تصدر فتوى ولا تدّعِ أن هذه النتيجة تغني عن الرجوع إلى المصادر والمختصين. أعد JSON فقط مطابقاً للمخطط؛ اجعل المصادر وأقوال الأئمة مصفوفات فارغة عند غياب التوثيق بدلاً من اختلاق معلومات.`;

export async function analyzeHadith(text: string) {
  try {
    const response = await invokeLLM({
      model: "gpt-5",
      maxCompletionTokens: 3400,
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
