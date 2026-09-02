import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, BookOpenCheck, Loader2, Sparkles } from "lucide-react";

type HadithSearchProps = {
  value: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSuggestion: (value: string) => void;
};

const suggestions = [
  "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى",
  "مَنْ كَذَبَ عَلَيَّ مُتَعَمِّدًا فَلْيَتَبَوَّأْ مَقْعَدَهُ مِنَ النَّارِ",
  "اطْلُبُوا الْعِلْمَ وَلَوْ بِالصِّينِ",
];

export function HadithSearch({ value, isLoading, onChange, onSubmit, onSuggestion }: HadithSearchProps) {
  return (
    <section className="relative mx-auto w-full max-w-4xl" aria-labelledby="search-title">
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-emerald-500/5 blur-3xl" />
      <div className="research-card overflow-hidden p-1.5 sm:p-2">
        <div className="rounded-[1.2rem] bg-card/75 p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-3 text-right">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-700/15"><BookOpenCheck className="size-5" /></span>
            <div>
              <h2 id="search-title" className="text-lg font-bold text-foreground">أدخل متن الحديث</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">يمكنك إدخال متن طويل أو جزء مميّز منه للفحص الأولي.</p>
            </div>
          </div>
          <textarea
            value={value}
            onChange={event => onChange(event.target.value)}
            dir="rtl"
            disabled={isLoading}
            placeholder="مثال: إنما الأعمال بالنيات..."
            className="hadith-input min-h-44 w-full resize-y rounded-2xl border border-border bg-background/80 p-4 text-right text-lg leading-9 text-foreground outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 disabled:cursor-not-allowed disabled:opacity-60 sm:p-5"
            aria-label="نص الحديث المراد فحصه"
          />
          <div className="mt-3 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={cn("text-xs", value.length > 6000 ? "text-red-600" : "text-muted-foreground")}>{value.length.toLocaleString("ar-EG")} / ٦٬٠٠٠ حرف</p>
            <Button onClick={onSubmit} disabled={isLoading || value.trim().length < 12} size="lg" className="h-12 rounded-xl bg-emerald-700 px-6 text-base font-bold shadow-lg shadow-emerald-900/15 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500">
              {isLoading ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
              {isLoading ? "جارٍ الفحص والتحليل" : "فحص الحديث"}
              {!isLoading && <ArrowLeft className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5" aria-label="اقتراحات للتجربة">
        <span className="mx-1 text-xs font-semibold text-muted-foreground">جرّب مثالاً:</span>
        {suggestions.map((suggestion, index) => (
          <button key={suggestion} type="button" disabled={isLoading} onClick={() => onSuggestion(suggestion)} className="suggestion-chip max-w-full rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 sm:text-sm">
            {index === 0 ? "حديث النيات" : index === 1 ? "حديث الكذب على النبي" : "طلب العلم"}
          </button>
        ))}
      </div>
    </section>
  );
}
