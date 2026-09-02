import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ShareCard } from "@/components/ShareCard";
import { useHadithExport } from "@/hooks/useHadithExport";
import type { HadithAnalysis } from "@shared/hadith";
import { getHadithGradeTone } from "@shared/hadithPresentation";
import { AlertTriangle, BookMarked, CheckCircle2, ChevronLeft, Copy, Download, FileText, Landmark, Quote, Scale, ScrollText } from "lucide-react";
import React from "react";
import { toast } from "sonner";

type ResultCardProps = {
  result: HadithAnalysis;
  favorite: boolean;
  onToggleFavorite: () => void;
};

const gradeStyles = {
  positive: { className: "bg-green-100 text-green-800 ring-green-200 dark:bg-green-950/70 dark:text-green-300 dark:ring-green-900", icon: CheckCircle2 },
  caution: { className: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900", icon: CheckCircle2 },
  negative: { className: "bg-red-100 text-red-800 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900", icon: AlertTriangle },
};

export function ResultCard({ result, favorite, onToggleFavorite }: ResultCardProps) {
  const style = gradeStyles[getHadithGradeTone(result.grade)];
  const GradeIcon = style.icon;
  const { exporting, exportCard } = useHadithExport(result);
  const copyText = async () => {
    try { await navigator.clipboard.writeText(result.matn); toast.success("تم نسخ متن الحديث."); }
    catch { toast.error("تعذّر نسخ النص من المتصفح."); }
  };
  const handleExport = async (kind: "png" | "pdf") => {
    try {
      await exportCard(kind);
      toast.success(kind === "png" ? "تم تنزيل بطاقة الصورة." : "تم تنزيل ملف PDF.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر تجهيز ملف التصدير. حاول مرة أخرى.");
    }
  };
  return (
    <section className="mx-auto mt-10 w-full max-w-4xl animate-in fade-in slide-in-from-bottom-3 duration-500" aria-labelledby="result-title">
      <div className="research-card overflow-hidden">
        <div className="border-b border-border bg-gradient-to-l from-stone-950 via-stone-900 to-stone-800 px-5 py-5 text-stone-50 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-white/10"><ScrollText className="size-5" /></span><div><p className="text-xs font-semibold text-stone-200">نتيجة الفحص</p><h2 id="result-title" className="text-lg font-bold">خلاصة التخريج والتحليل</h2></div></div>
            <div className="flex items-center gap-2"><button onClick={copyText} className="icon-button" aria-label="نسخ متن الحديث"><Copy className="size-4" /></button><button onClick={onToggleFavorite} className="icon-button" aria-label={favorite ? "إزالة من المفضلة" : "حفظ في المفضلة"}><BookMarked className={favorite ? "size-4 fill-amber-300 text-amber-300" : "size-4"} /></button></div>
          </div>
        </div>
        <article className="p-5 sm:p-7">
          <div className="flex min-w-0 flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="w-full min-w-0"><p className="mb-3 text-sm font-semibold text-muted-foreground">الدرجة الظاهرة</p><div className={`hadith-grade-badge rounded-full text-sm font-bold ring-1 ${style.className}`}><GradeIcon className="ml-1.5 mt-0.5 size-4 shrink-0" /><span className="min-w-0 break-words">{result.grade}</span><span className="hadith-grade-detail font-normal">{result.gradeType}</span></div></div>
            <p className="max-w-md break-words rounded-xl bg-muted/70 p-3 text-sm leading-7 text-muted-foreground"><strong className="text-foreground">ملخص موجز: </strong>{result.summary}</p>
          </div>
          <div className="illuminated-frame hadith-text hadith-safe-text my-6 max-w-full rounded-2xl border border-amber-700/15 bg-amber-50/70 px-5 py-6 text-center text-[1.32rem] leading-[2.5] text-foreground dark:border-amber-300/15 dark:bg-amber-100/5 sm:px-8 sm:text-[1.55rem]">{result.matn}</div>
          <div className="mb-5 flex gap-3 rounded-xl border border-amber-700/10 bg-amber-50/70 p-3.5 text-sm leading-6 text-amber-950 dark:border-amber-300/10 dark:bg-amber-100/5 dark:text-amber-100"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p><strong>تنبيه منهجي: </strong>{result.confidenceNote}</p></div>
          <Accordion type="multiple" className="space-y-3">
            <AccordionItem value="sources" className="detail-accordion"><AccordionTrigger><span className="flex items-center gap-2"><Landmark className="size-4 text-stone-700" />التخريج والمصادر</span></AccordionTrigger><AccordionContent>{result.sources.length ? <div className="space-y-3">{result.sources.map((source, index) => <div key={`${source.book}-${index}`} className="source-row"><div><h3>{source.book}</h3><p>{source.reference}</p></div><p>{source.note}</p></div>)}</div> : <p className="detail-empty">لم يتيسر إيراد مصدرٍ موثق من النتيجة الآلية. راجع كتب التخريج المتخصصة.</p>}</AccordionContent></AccordionItem>
            <AccordionItem value="study" className="detail-accordion"><AccordionTrigger><span className="flex items-center gap-2"><Scale className="size-4 text-stone-700" />دراسة السند والمتن</span></AccordionTrigger><AccordionContent><div className="grid gap-5 md:grid-cols-2"><div><h3 className="detail-heading">دراسة السند</h3>{result.isnadStudy.length ? <ul className="detail-list">{result.isnadStudy.map(item => <li key={item}>{item}</li>)}</ul> : <p className="detail-empty">لا توجد تفاصيل إسنادية موثقة ضمن المدخل.</p>}</div><div><h3 className="detail-heading">دراسة المتن</h3>{result.matnStudy.length ? <ul className="detail-list">{result.matnStudy.map(item => <li key={item}>{item}</li>)}</ul> : <p className="detail-empty">لا توجد تفاصيل متنية موثقة ضمن المدخل.</p>}</div></div></AccordionContent></AccordionItem>
            <AccordionItem value="scholars" className="detail-accordion"><AccordionTrigger><span className="flex items-center gap-2"><Quote className="size-4 text-stone-700" />أقوال أئمة النقد</span></AccordionTrigger><AccordionContent>{result.scholars.length ? <div className="space-y-3">{result.scholars.map((scholar, index) => <blockquote key={`${scholar.scholar}-${index}`} className="scholar-quote"><p>«{scholar.opinion}»</p><footer><strong>{scholar.scholar}</strong><span>{scholar.conclusion}</span></footer></blockquote>)}</div> : <p className="detail-empty">لم تُنسب أقوال في هذه النتيجة لتجنب النقل بغير تثبت.</p>}</AccordionContent></AccordionItem>
          </Accordion>
          <section className="mt-7 border-t border-border pt-6" aria-labelledby="share-title">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold text-stone-700 dark:text-stone-300">للمشاركة والمراجعة</p><h3 id="share-title" className="mt-1 font-bold text-foreground">بطاقة النتيجة المختصرة</h3></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={exporting !== null} onClick={() => handleExport("png")} className="bg-background"><Download className="size-4" />{exporting === "png" ? "جارٍ تجهيز الصورة" : "تنزيل صورة"}</Button><Button size="sm" disabled={exporting !== null} onClick={() => handleExport("pdf")} className="bg-stone-700 text-white hover:bg-stone-800 dark:bg-stone-600"><FileText className="size-4" />{exporting === "pdf" ? "جارٍ تجهيز PDF" : "تنزيل PDF"}</Button></div></div>
            <ShareCard result={result} />
          </section>
          <p className="mt-5 flex items-start gap-2 text-xs leading-6 text-muted-foreground"><ChevronLeft className="mt-0.5 size-3.5 shrink-0" />{result.caution}</p>
        </article>
      </div>
    </section>
  );
}
