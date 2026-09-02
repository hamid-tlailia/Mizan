import type { ReviewSummary } from "@/lib/reviewState";
import { ClipboardCheck } from "lucide-react";
import React from "react";

export function ReviewProgress({ summary }: { summary: ReviewSummary }) {
  const reviewed = summary.verified + summary.flagged + summary.rejected;
  const pct = summary.total ? Math.round((reviewed / summary.total) * 100) : 0;
  return (
    <div className="review-progress">
      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
        <ClipboardCheck className="size-4 text-stone-700 dark:text-stone-300" />
        <span>تقدّم المراجعة العلمية</span>
        <span className="mr-auto text-xs font-semibold text-muted-foreground">{reviewed} من {summary.total}</span>
      </div>
      <div className="review-progress-track">
        <div className="review-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="review-progress-legend">
        <span className="legend-verified">تحقق: {summary.verified}</span>
        <span className="legend-flagged">للمراجعة: {summary.flagged}</span>
        <span className="legend-rejected">مرفوض: {summary.rejected}</span>
        <span className="legend-pending">لم يُراجَع: {summary.pending}</span>
      </div>
    </div>
  );
}
