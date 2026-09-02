import type { HadithAnalysis } from "@shared/hadith";
import { getHadithGradeTone } from "@shared/hadithPresentation";
import { BookOpenCheck, Scale } from "lucide-react";
import React, { forwardRef } from "react";

type ShareCardProps = { result: HadithAnalysis };

const toneStyles = {
  positive: "border-[#a7d8bd] bg-[#eaf7ef] text-[#17633d]",
  caution: "border-[#f2d675] bg-[#fff7d6] text-[#8c4b12]",
  negative: "border-[#f1b6ad] bg-[#fff0ed] text-[#9f3025]",
};

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard({ result }, ref) {
  const matn = result.matn.length > 460 ? `${result.matn.slice(0, 460).trim()}…` : result.matn;
  const tone = getHadithGradeTone(result.grade);
  return (
    <article ref={ref} dir="rtl" className="share-card" data-hadith-share-card aria-label="معاينة بطاقة المشاركة">
      <div className="share-card-topline"><span className="share-card-mark"><Scale className="size-5" /></span><div><p>ميزان الحديث</p><small>نتيجة فحص وتخريج مبدئية</small></div><BookOpenCheck className="mr-auto size-6 text-amber-300/80" /></div>
      <div className="share-card-body"><p className="share-card-label">متن الحديث</p><p className="share-card-matn">{matn}</p><div className="share-card-grade"><span className={`share-card-badge ${toneStyles[tone]}`}>{result.grade}</span><span className="share-card-grade-type">{result.gradeType}</span></div><p className="share-card-summary">{result.summary}</p></div>
      <footer>هذه نتيجة مساعدة للبحث؛ تُراجع المصادر وأهل الاختصاص عند الحاجة.</footer>
    </article>
  );
});
