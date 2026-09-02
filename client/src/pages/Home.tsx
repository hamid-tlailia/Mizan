import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HadithSearch } from "@/components/HadithSearch";
import { AnalysisSkeleton } from "@/components/AnalysisSkeleton";
import { SavedPanel } from "@/components/SavedPanel";
import { useTheme } from "@/contexts/ThemeContext";
import { useHadithAnalysisService, validateHadithRequest } from "@/lib/hadithService";
import { FAVORITES_KEY, HISTORY_KEY, limitStored, loadStoredHadith, makeStoredHadith, saveStoredHadith } from "@/lib/hadithStorage";
import type { StoredHadith } from "@shared/hadith";
import { getHadithDossierPath } from "@shared/hadithDossierRoute";
import { BookOpenCheck, History, Moon, Star, Sun, WifiOff } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();
  const [text, setText] = useState("");
  const [history, setHistory] = useState<StoredHadith[]>([]);
  const [favorites, setFavorites] = useState<StoredHadith[]>([]);
  const [view, setView] = useState<"home" | "saved">("home");
  const [alert, setAlert] = useState<string | null>(null);
  const analysis = useHadithAnalysisService();
  useEffect(() => { setHistory(loadStoredHadith(HISTORY_KEY)); setFavorites(loadStoredHadith(FAVORITES_KEY)); }, []);
  const checkHadith = () => {
    const inputError = validateHadithRequest(text);
    if (inputError) { setAlert(inputError); return; }
    setAlert(null); setView("home");
    analysis.analyze(text, { onSuccess: data => { const item = makeStoredHadith(data); const nextHistory = limitStored([item, ...history.filter(old => old.matn !== item.matn)], 12); setHistory(nextHistory); saveStoredHadith(HISTORY_KEY, nextHistory); toast.success("اكتمل التحليل الأولي. يجري فتح ملف الحديث."); setLocation(getHadithDossierPath(item.id)); }, onError: setAlert });
  };
  const chooseSuggestion = (suggestion: string) => { setText(suggestion); setAlert(null); };
  const selectSaved = (item: StoredHadith) => setLocation(getHadithDossierPath(item.id));
  const removeFavorite = (id: string) => { const next = favorites.filter(item => item.id !== id); setFavorites(next); saveStoredHadith(FAVORITES_KEY, next); };
  return <div dir="rtl" className="min-h-screen overflow-x-hidden bg-background text-foreground"><header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl"><div className="container flex h-16 items-center justify-between gap-3"><button onClick={() => setView("home")} className="group flex items-center gap-2.5 text-right"><span className="grid size-9 place-items-center rounded-xl bg-emerald-700 text-white shadow-md shadow-emerald-900/15"><ScaleIcon /></span><span><strong className="block text-base leading-5">ميزان الحديث</strong><small className="block text-[10px] text-muted-foreground">أداة بحثية مساعدة</small></span></button><nav className="hidden items-center gap-1 sm:flex"><button onClick={() => setView("home")} className={`nav-link ${view === "home" ? "nav-active" : ""}`}>الفحص</button><button onClick={() => setView("saved")} className={`nav-link ${view === "saved" ? "nav-active" : ""}`}><History className="size-3.5" />السجل والمفضلة</button></nav><div className="flex items-center gap-1"><button onClick={() => setView("saved")} className="icon-theme-button sm:hidden" aria-label="السجل والمفضلة"><Star className="size-4" /></button><button onClick={toggleTheme} className="icon-theme-button" aria-label="تبديل الوضع اللوني">{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</button></div></div></header>{view === "home" ? <main><section className="hero-section"><div className="container"><div className="mx-auto max-w-3xl text-center"><p className="eyebrow"><BookOpenCheck className="size-4" />فحص وتخريج مبدئي</p><h1 className="mt-5 text-4xl font-extrabold leading-[1.35] tracking-tight text-foreground sm:text-5xl">تحرَّ عن الحديث<br className="hidden sm:block" /> <span className="text-emerald-700 dark:text-emerald-400">بميزان العلم</span></h1><p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">يفتح كل فحص في ملف بحث مستقل يضم الخلاصة الأولية، والبحث المصدرّي، ودفتر ملاحظاتك المحلي.</p></div><div className="mt-10"><HadithSearch value={text} isLoading={analysis.isPending} onChange={setText} onSubmit={checkHadith} onSuggestion={chooseSuggestion} /></div></div></section><div className="container pb-16">{alert && <Alert variant="destructive" className="mx-auto mt-8 max-w-4xl text-right"><WifiOff className="size-4" /><AlertTitle>تعذّر إكمال الطلب</AlertTitle><AlertDescription>{alert}</AlertDescription></Alert>}{analysis.isPending && <AnalysisSkeleton />}{!analysis.isPending && <section className="mx-auto mt-14 grid max-w-4xl gap-4 md:grid-cols-3"><Feature title="ملف بحث مستقل" text="تُفتح كل نتيجة في صفحة مخصصة للتدقيق والتدوين." icon={<ScaleIcon />} /><Feature title="بحث مصدرّي" text="يفصل نتائج مجموعة البيانات عن التحليل الآلي بوضوح." icon={<BookOpenCheck />} /><Feature title="خصوصية محلية" text="السجل والمفضلة والملاحظات محفوظة على جهازك فقط." icon={<Star />} /></section>}</div></main> : <SavedPanel history={history} favorites={favorites} onSelect={selectSaved} onRemoveFavorite={removeFavorite} />}<footer className="container border-t border-border py-7 text-center text-xs leading-6 text-muted-foreground">ميزان الحديث أداة مساعدة للبحث والتنظيم؛ لا تغني نتائجها عن مراجعة مصادر الحديث والرجوع إلى أهل الاختصاص.</footer></div>;
}

function ScaleIcon() { return <span className="text-lg font-bold leading-none">م</span>; }
function Feature({ title, text, icon }: { title: string; text: string; icon: React.ReactNode }) { return <div className="feature-card"><span className="feature-icon">{icon}</span><h2>{title}</h2><p>{text}</p></div>; }
