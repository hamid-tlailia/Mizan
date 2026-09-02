import { ReviewControl } from "@/components/ReviewControl";
import type { HadithTariq } from "@shared/hadith";
import type { ReviewEntry, ReviewMap } from "@/lib/reviewState";
import { GitBranch, ShieldQuestion, UserRound } from "lucide-react";
import React from "react";

export function turuqClaimIds(turuq: HadithTariq[]): string[] {
  const ids: string[] = [];
  turuq.forEach((tariq, i) => {
    ids.push(`tariq:${i}`);
    tariq.narrators.forEach((narrator, j) => {
      narrator.opinions.forEach((_opinion, k) => ids.push(`opinion:${i}:${j}:${k}`));
    });
  });
  return ids;
}

type TuruqSectionProps = {
  hadithId: string;
  turuq: HadithTariq[];
  reviewMap: ReviewMap;
  onReviewChange: (claimId: string, entry: ReviewEntry | null) => void;
};

export function TuruqSection({ hadithId, turuq, reviewMap, onReviewChange }: TuruqSectionProps) {
  if (!turuq.length) {
    return (
      <div className="narrator-limit">
        <ShieldQuestion className="size-5 shrink-0" />
        <p>لم يتمكن الفحص الآلي من إثبات طرق أو رواة بثقة كافية لهذا النص. راجع المصادر أدناه يدوياً قبل تدوين أي حكم.</p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {turuq.map((tariq, i) => (
        <article key={`${tariq.label}-${i}`} className="tariq-card">
          <header className="tariq-header">
            <span className="tariq-badge"><GitBranch className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="break-words text-sm font-bold text-foreground">{tariq.label}</h3>
              <p className="mt-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{tariq.grade}</p>
            </div>
            <ReviewControl hadithId={hadithId} claimId={`tariq:${i}`} entry={reviewMap[`tariq:${i}`]} onChange={onReviewChange} />
          </header>
          {tariq.note ? <p className="mt-2 break-words text-xs leading-6 text-muted-foreground">{tariq.note}</p> : null}
          <ol className="tariq-narrator-chain">
            {tariq.narrators.map((narrator, j) => (
              <li key={`${narrator.name}-${j}`} className="narrator-node">
                <div className="narrator-node-head">
                  <span className="narrator-avatar"><UserRound className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-bold text-foreground">{narrator.name}</p>
                    <p className="text-xs text-muted-foreground">{narrator.tabaqah}{narrator.role ? ` — ${narrator.role}` : ""}</p>
                  </div>
                </div>
                {narrator.opinions.length ? (
                  <div className="mt-3 space-y-2 pr-4">
                    {narrator.opinions.map((opinion, k) => {
                      const claimId = `opinion:${i}:${j}:${k}`;
                      return (
                        <div key={claimId} className="narrator-opinion">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="break-words text-sm leading-7"><strong className="text-emerald-800 dark:text-emerald-300">{opinion.scholar}: </strong>«{opinion.statement}»<span className="verdict-chip">{opinion.verdict}</span></p>
                            <ReviewControl hadithId={hadithId} claimId={claimId} entry={reviewMap[claimId]} onChange={onReviewChange} />
                          </div>
                          {opinion.documented ? (
                            <p className="mt-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">موثّق: {opinion.book} — {opinion.reference}</p>
                          ) : (
                            <p className="mt-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">غير موثّق بكتاب وموضع محدَّدين — يلزم التحقق قبل الاعتماد.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}
