export type HadithGrade = "صحيح" | "حسن" | "ضعيف" | "موضوع" | "مختلف فيه";

export type HadithSource = {
  book: string;
  reference: string;
  note: string;
};

export type ScholarlyOpinion = {
  scholar: string;
  opinion: string;
  conclusion: string;
};

export type NarratorVerdict = "ثقة" | "صدوق" | "لين الحديث" | "ضعيف" | "متروك" | "مختلف فيه" | "غير محرر";

export type NarratorOpinion = {
  scholar: string;
  statement: string;
  verdict: NarratorVerdict;
  book: string;
  reference: string;
  documented: boolean;
};

export type HadithNarrator = {
  name: string;
  tabaqah: string;
  role: string;
  opinions: NarratorOpinion[];
};

export type HadithTariq = {
  label: string;
  grade: string;
  note: string;
  narrators: HadithNarrator[];
};

export type HadithAnalysis = {
  matn: string;
  grade: HadithGrade;
  gradeType: string;
  summary: string;
  confidenceNote: string;
  sources: HadithSource[];
  isnadStudy: string[];
  matnStudy: string[];
  scholars: ScholarlyOpinion[];
  turuq: HadithTariq[];
  caution: string;
};

export type StoredHadith = HadithAnalysis & {
  id: string;
  checkedAt: number;
};
