import { trpc } from "@/lib/trpc";
import type { HadithAnalysis } from "@shared/hadith";

export function validateHadithRequest(text: string): string | null {
  if (!navigator.onLine) return "لا يوجد اتصال بالإنترنت. تحقّق من الشبكة ثم أعد المحاولة.";
  if (text.trim().length < 12) return "أدخل نصاً أوضح من متن الحديث، لا يقل عن ١٢ حرفاً.";
  if (text.length > 6000) return "النص المدخل طويل جداً. يرجى الاقتصار على متن الحديث أو الجزء المميّز منه.";
  return null;
}

export function getHadithServiceErrorMessage(error: unknown): string {
  const fallback = "تعذّر إتمام الفحص الآن. تحقّق من الاتصال ثم حاول مرة أخرى.";
  if (!(error instanceof Error)) return fallback;
  if (error.message.includes("أدخل نصاً أوضح") || error.message.includes("تعذّر فهم النص")) return "تعذّر فهم النص المدخل. جرّب كتابة متن أوضح أو أضف جزءاً مميّزاً منه.";
  if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) return "تعذّر الوصول إلى خدمة الفحص. تحقّق من اتصال الإنترنت ثم أعد المحاولة.";
  return error.message || fallback;
}

export function useHadithAnalysisService() {
  const mutation = trpc.hadith.analyze.useMutation();
  return {
    isPending: mutation.isPending,
    analyze: (text: string, handlers: { onSuccess: (analysis: HadithAnalysis) => void; onError: (message: string) => void }) => {
      mutation.mutate({ text }, { onSuccess: handlers.onSuccess, onError: error => handlers.onError(getHadithServiceErrorMessage(error)) });
    },
  };
}
