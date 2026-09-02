import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { clearReviewEntry, saveReviewEntry, type ReviewEntry, type ReviewStatus } from "@/lib/reviewState";
import { CircleAlert, CircleCheck, CircleX, MessageSquareText } from "lucide-react";
import React, { useState } from "react";

const STATUS_META: Record<ReviewStatus, { label: string; icon: typeof CircleCheck; className: string }> = {
  pending: { label: "لم تُراجَع", icon: MessageSquareText, className: "review-btn-pending" },
  verified: { label: "تم التحقق", icon: CircleCheck, className: "review-btn-verified" },
  flagged: { label: "يحتاج مراجعة", icon: CircleAlert, className: "review-btn-flagged" },
  rejected: { label: "مرفوض", icon: CircleX, className: "review-btn-rejected" },
};

type ReviewControlProps = {
  hadithId: string;
  claimId: string;
  entry?: ReviewEntry;
  onChange: (claimId: string, entry: ReviewEntry | null) => void;
};

export function ReviewControl({ hadithId, claimId, entry, onChange }: ReviewControlProps) {
  const [note, setNote] = useState(entry?.note ?? "");
  const [open, setOpen] = useState(false);
  const status = entry?.status ?? "pending";

  const setStatus = (next: ReviewStatus) => {
    if (status === next) {
      const cleared = clearReviewEntry(hadithId, claimId);
      onChange(claimId, cleared[claimId] ?? null);
      return;
    }
    const updated = saveReviewEntry(hadithId, claimId, next, note);
    onChange(claimId, updated[claimId]);
  };

  const saveNote = () => {
    const updated = saveReviewEntry(hadithId, claimId, status === "pending" ? "flagged" : status, note);
    onChange(claimId, updated[claimId]);
    setOpen(false);
  };

  return (
    <div className="review-control" role="group" aria-label="مراجعة هذا العنصر">
      {(["verified", "flagged", "rejected"] as const).map(option => {
        const meta = STATUS_META[option];
        const Icon = meta.icon;
        const active = status === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setStatus(option)}
            className={`review-btn ${active ? meta.className : ""}`}
            aria-pressed={active}
            title={meta.label}
          >
            <Icon className="size-3.5" />
            <span>{meta.label}</span>
          </button>
        );
      })}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={`review-btn ${entry?.note ? "review-btn-note" : ""}`} title="ملاحظة المراجعة">
            <MessageSquareText className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 text-right">
          <p className="mb-2 text-xs font-bold text-foreground">ملاحظة المراجعة</p>
          <Textarea value={note} onChange={event => setNote(event.target.value)} placeholder="سبب الرفض أو مصدر التحقق المستخدم…" className="min-h-24 text-sm" />
          <button type="button" onClick={saveNote} className="mt-2 w-full rounded-lg bg-emerald-700 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 dark:bg-emerald-600">
            حفظ الملاحظة
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
