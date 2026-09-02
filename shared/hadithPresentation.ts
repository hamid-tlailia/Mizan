import type { HadithGrade } from "./hadith";

export type HadithGradeTone = "positive" | "caution" | "negative";

export function getHadithGradeTone(grade: HadithGrade): HadithGradeTone {
  if (grade === "صحيح") return "positive";
  if (grade === "ضعيف" || grade === "موضوع") return "negative";
  return "caution";
}
