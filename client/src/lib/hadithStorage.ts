import type { HadithAnalysis, StoredHadith } from "@shared/hadith";

export const HISTORY_KEY = "mizan-hadith-history";
export const FAVORITES_KEY = "mizan-hadith-favorites";
export const NOTES_KEY = "mizan-hadith-research-notes";

export function loadStoredHadith(key: string): StoredHadith[] {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as StoredHadith[] : []; } catch { return []; }
}

export function saveStoredHadith(key: string, values: StoredHadith[]) { localStorage.setItem(key, JSON.stringify(values)); }
export function limitStored(items: StoredHadith[], limit: number) { return items.slice(0, limit); }

export function makeStoredHadith(data: HadithAnalysis): StoredHadith { return { ...data, id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, checkedAt: Date.now() }; }

export function loadResearchNotes(): Record<string, string> {
  try { const raw = localStorage.getItem(NOTES_KEY); return raw ? JSON.parse(raw) as Record<string, string> : {}; } catch { return {}; }
}

export function writeResearchNote(id: string, note: string) {
  const notes = loadResearchNotes();
  localStorage.setItem(NOTES_KEY, JSON.stringify({ ...notes, [id]: note }));
}
