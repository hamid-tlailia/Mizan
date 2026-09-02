import { Skeleton } from "@/components/ui/skeleton";

export function AnalysisSkeleton() {
  return (
    <section className="mx-auto mt-10 w-full max-w-4xl" aria-live="polite" aria-label="جارٍ إعداد نتيجة تحليل الحديث">
      <div className="research-card overflow-hidden p-5 sm:p-7">
        <div className="mb-7 flex items-center justify-between gap-5">
          <div className="space-y-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-9 w-52" /></div>
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
        <Skeleton className="h-7 w-full" /><Skeleton className="mt-3 h-7 w-11/12" /><Skeleton className="mt-3 h-7 w-4/5" />
        <div className="mt-8 space-y-3 border-t border-border pt-6"><Skeleton className="h-15 w-full rounded-xl" /><Skeleton className="h-15 w-full rounded-xl" /><Skeleton className="h-15 w-full rounded-xl" /></div>
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">يجري تنظيم التخريج ودراسة السند والمتن…</p>
    </section>
  );
}
