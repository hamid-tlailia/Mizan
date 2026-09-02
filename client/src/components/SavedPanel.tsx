import type { StoredHadith } from "@shared/hadith";
import { BookmarkX, Clock3, History, Star } from "lucide-react";
import React from "react";

type SavedPanelProps = { history: StoredHadith[]; favorites: StoredHadith[]; onSelect: (item: StoredHadith) => void; onRemoveFavorite: (id: string) => void };

function SavedList({ title, icon, items, empty, onSelect, action }: { title: string; icon: React.ReactNode; items: StoredHadith[]; empty: string; onSelect: (item: StoredHadith) => void; action?: (id: string) => void }) {
  return <section className="saved-panel research-card min-w-0 overflow-hidden p-5 sm:p-6"><div className="mb-4 flex min-w-0 items-center gap-2 text-foreground">{icon}<h2 className="min-w-0 font-bold">{title}</h2><span className="mr-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{items.length.toLocaleString("ar-EG")}</span></div>{items.length ? <div className="space-y-2">{items.map(item => <div key={item.id} className="saved-item"><button className="min-w-0 flex-1 overflow-hidden text-right" onClick={() => onSelect(item)}><p className="saved-hadith-matn">{item.matn}</p><p className="saved-hadith-meta"><span className="saved-grade">{item.grade}</span><span aria-hidden="true">·</span><time>{new Date(item.checkedAt).toLocaleDateString("ar-EG")}</time></p></button>{action && <button onClick={() => action(item.id)} aria-label="إزالة من المفضلة" className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"><BookmarkX className="size-4" /></button>}</div>)}</div> : <p className="py-6 text-center text-sm leading-7 text-muted-foreground">{empty}</p>}</section>;
}

export function SavedPanel({ history, favorites, onSelect, onRemoveFavorite }: SavedPanelProps) {
  return <main className="mx-auto mt-10 grid w-full max-w-5xl gap-5 lg:grid-cols-2"><SavedList title="المفضلة" icon={<Star className="size-5 text-amber-500" />} items={favorites} empty="لم تحفظ أي نتيجة بعد. استخدم رمز العلامة من بطاقة النتيجة." onSelect={onSelect} action={onRemoveFavorite} /><SavedList title="آخر الفحوصات" icon={<History className="size-5 text-stone-700" />} items={history} empty="ستظهر هنا نتائج الأحاديث التي تفحصها حديثاً." onSelect={onSelect} /><div className="lg:col-span-2 flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" />يُحفظ السجل والمفضلة على جهازك فقط.</div></main>;
}
