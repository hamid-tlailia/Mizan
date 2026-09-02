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
  caution: string;
};

export type StoredHadith = HadithAnalysis & {
  id: string;
  checkedAt: number;
};
