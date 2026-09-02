import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ResultCard } from "@/components/ResultCard";
import { ReviewProgress } from "@/components/ReviewProgress";
import { TuruqSection, turuqClaimIds } from "@/components/TuruqSection";
import { useTheme } from "@/contexts/ThemeContext";
import { loadResearchNotes, loadStoredHadith, writeResearchNote, FAVORITES_KEY, HISTORY_KEY, limitStored, saveStoredHadith } from "@/lib/hadithStorage";
import { loadReview, summarizeReview, type ReviewEntry, type ReviewMap } from "@/lib/reviewState";
import type { StoredHadith } from "@shared/hadith";
import { ArrowRight, BookOpenCheck, BookText, ExternalLink, FileSearch, History, Moon, NotebookPen, Scale, SearchX, Sun, UserRoundSearch } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";

const NARRATOR_SOURCES = [
  {
    title: "الجرح والتعديل",
    author: "ابن أبي حاتم الرازي",
    note: "نص رقمي مفهرس للقراءة والتحقق اليدوي. لا يولّد التطبيق منه حكماً أو ينسب قولاً قبل ربطه بموضع محدد.",
    href: "https://shamela.ws/book/2170",
    source: "المكتبة الشاملة",
  },
  {
    title: "التاريخ ليحيى بن معين — رواية الدوري",
    author: "يحيى بن معين؛ تحقيق محمد بن علي الأزهري",
    note: "نسخة مصوّرة مفهرسة من مجلدين، 872 صفحة. تُستخدم لإحالة الباحث إلى المصدر والصفحة عند التحقق، لا لاستخراج آلي غير مراجع.",
    href: "https://waqfeya.com/books/%D8%A7%D9%84%D8%AA%D8%A7%D8%B1%D9%8A%D8%AE-%D9%84%D9%8A%D8%AD%D9%8A%D9%89-%D8%A8%D9%86-%D9%85%D8%B9%D9%8A%D9%86-%D8%B1%D9%88%D8%A7%D9%8A%D8%A9-%D8%A7%D9%84%D8%AF%D9%88%D8%B1%D9%8A/eddae8ba13064507a299eb721b0900d1",
    source: "المكتبة الوقفية",
  },
] as const;

export default function HadithDossier() {
  const [, params] = useRoute("/hadith/:id");
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [record, setRecord] = useState<StoredHadith | null>(null);
  const [favorites, setFavorites] = useState<StoredHadith[]>([]);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState(false);
  const [reviewMap, setReviewMap] = useState<ReviewMap>({});

  useEffect(() => {
    const history = loadStoredHadith(HISTORY_KEY);
    const current = history.find(item => item.id === params?.id) ?? null;
    setRecord(current);
    setFavorites(loadStoredHadith(FAVORITES_KEY));
    setNote(current ? loadResearchNotes()[current.id] ?? "" : "");
    setReviewMap(current ? loadReview(current.id) : {});
  }, [params?.id]);

  const claimIds = useMemo(() => (record ? turuqClaimIds(record.turuq) : []), [record]);
  const reviewSummary = useMemo(() => summarizeReview(reviewMap, claimIds), [reviewMap, claimIds]);
  const handleReviewChange = (claimId: string, entry: ReviewEntry | null) => {
    setReviewMap(prev => {
      const next = { ...prev };
      if (entry) next[claimId] = entry;
      else delete next[claimId];
      return next;
    });
  };

  const toggleFavorite = () => {
    if (!record) return;
    const exists = favorites.some(item => item.id === record.id);
    const updated = exists ? favorites.filter(item => item.id !== record.id) : limitStored([record, ...favorites], 30);
    setFavorites(updated);
    saveStoredHadith(FAVORITES_KEY, updated);
  };

  const saveNote = () => {
    if (!record) return;
    writeResearchNote(record.id, note);
    setSavedNote(true);
    window.setTimeout(() => setSavedNote(false), 1800);
  };

  if (!record) {
    return <div dir="rtl" className="min-h-screen bg-background text-foreground"><DossierHeader theme={theme} onTheme={toggleTheme} onBack={() => setLocation("/")} /><main className="container py-20"><Alert className="mx-auto max-w-2xl text-right"><SearchX className="size-4" /><AlertTitle>لم يُعثر على ملف الحديث</AlertTitle><AlertDescription>قد تكون النتيجة محفوظة على جهاز آخر أو حُذفت من السجل المحلي. ابدأ فحصاً جديداً لإنشاء ملف بحثي.</AlertDescription></Alert><div className="mt-6 text-center"><Button onClick={() => setLocation("/")}>العودة إلى الفحص</Button></div></main></div>;
  }

  return <div dir="rtl" className="min-h-screen bg-background text-foreground">
    <DossierHeader theme={theme} onTheme={toggleTheme} onBack={() => setLocation("/")} />
    <main className="container py-7 pb-16"><div className="mx-auto max-w-6xl">
      <div className="mb-6 flex min-w-0 flex-col gap-4 rounded-2xl border border-emerald-700/15 bg-emerald-700/6 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white"><FileSearch className="size-5" /></span><div className="min-w-0"><p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">ملف بحث الحديث</p><h1 className="mt-1 break-words text-lg font-bold">مسار موسع للتخريج والتدوين والمراجعة</h1><p className="mt-1 text-xs leading-6 text-muted-foreground">يُظهر المصدر المنقول بوضوح، ويفصل بين البيانات المصدرية وخلاصة التحليل الآلي.</p></div></div>
        <div className="flex flex-wrap gap-2"><span className="rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground"><History className="ml-1 inline size-3.5" />{new Date(record.checkedAt).toLocaleDateString("ar-EG")}</span><span className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">محفوظ على هذا الجهاز</span></div>
      </div>
      {claimIds.length > 0 ? <ReviewProgress summary={reviewSummary} /> : null}
      <ResultCard result={record} favorite={favorites.some(item => item.id === record.id)} onToggleFavorite={toggleFavorite} />
      <section className="research-dossier-card" aria-labelledby="turuq-title">
        <div className="dossier-heading"><div><p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">طرق الحديث والرواة</p><h2 id="turuq-title">تفصيل الأسانيد وأقوال أئمة الجرح والتعديل</h2></div><UserRoundSearch className="size-5 shrink-0 text-emerald-700" /></div>
        <p className="source-disclaimer">كل بيان أدناه مسودة من التحليل الآلي معروضة للمراجعة العلمية البشرية، وليست حكماً نهائياً. الأقوال المعلَّمة «غير موثّق» لم يذكر لها النموذج كتاباً وموضعاً محدَّدين عن ثقة، فتحقق منها من المصادر المرجعية قبل اعتمادها. استخدم أزرار المراجعة أسفل كل عنصر لتسجيل قرارك.</p>
        <div className="mt-5"><TuruqSection hadithId={record.id} turuq={record.turuq} reviewMap={reviewMap} onReviewChange={handleReviewChange} /></div>
      </section>
      <section className="research-dossier-card" aria-labelledby="sources-title">
        <div className="dossier-heading"><div><p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">مراجع التحقق</p><h2 id="sources-title">كتب الجرح والتعديل المتاحة للمراجعة اليدوية</h2></div><BookOpenCheck className="size-5 shrink-0 text-emerald-700" /></div>
        <p className="source-disclaimer">نسخ رقمية موثقة لكتب الرجال يمكن للباحث فتحها لمراجعة أي قول ظهر أعلاه أو للبحث عن رواة لم يذكرهم التحليل الآلي.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">{NARRATOR_SOURCES.map(book => <article className="corpus-book" key={book.title}><div className="p-4"><p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{book.source}</p><h3 className="mt-1 break-words font-bold text-foreground">{book.title}</h3><p className="mt-1 break-words text-xs leading-6 text-muted-foreground">{book.author}</p><p className="mt-3 break-words text-sm leading-7 text-muted-foreground">{book.note}</p><a href={book.href} target="_blank" rel="noreferrer" className="dataset-link mt-4"><span>فتح المصدر</span><ExternalLink className="size-3.5" /></a></div></article>)}</div>
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <section className="research-dossier-card"><div className="dossier-heading"><div><p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">حكم الأئمة على الحديث</p><h2>أقوال ظهرت في الخلاصة الآلية</h2></div><Scale className="size-5 shrink-0 text-emerald-700" /></div><div className="mt-5">{record.scholars.length ? <div className="space-y-3">{record.scholars.map((item, index) => <blockquote className="scholar-quote" key={`${item.scholar}-${index}`}><p>«{item.opinion}»</p><footer><strong>{item.scholar}</strong><span>{item.conclusion} — يلزم التحقق من المصدر قبل التدوين العلمي.</span></footer></blockquote>)}</div> : <p className="detail-empty">لا توجد أقوال منسوبة في النتيجة الحالية.</p>}</div></section>
        <section className="research-dossier-card"><div className="dossier-heading"><div><p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">دفتر الباحث</p><h2>ملاحظاتك المحلية</h2></div><NotebookPen className="size-5 shrink-0 text-emerald-700" /></div><p className="mb-3 text-sm leading-7 text-muted-foreground">سجّل اسم الراوي وموضع القول في المصدر بعد مراجعته. تُحفظ الملاحظة على جهازك فقط ولا تُرسل إلى أي خادم.</p><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="مثال: راجع قول ابن معين في التاريخ، المجلد ١، ص ١٢٣…" className="research-note-input" /><div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{savedNote ? "تم حفظ الملاحظة محلياً." : ""}</p><Button size="sm" onClick={saveNote} className="bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600">حفظ الملاحظة</Button></div></section>
      </div>
    </div></main>
  </div>;
}

function DossierHeader({ theme, onTheme, onBack }: { theme: "light" | "dark"; onTheme?: () => void; onBack: () => void }) {
  return <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl"><div className="container flex h-16 items-center justify-between gap-3"><button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-foreground"><ArrowRight className="size-4" />العودة إلى الفحص</button><div className="flex items-center gap-2"><span className="hidden text-xs font-semibold text-muted-foreground sm:inline">ميزان الحديث</span><button onClick={onTheme} className="icon-theme-button" aria-label="تبديل الوضع اللوني">{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</button></div></div></header>;
}

