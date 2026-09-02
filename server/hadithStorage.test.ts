import { afterEach, describe, expect, it, vi } from "vitest";
import { loadResearchNotes, makeStoredHadith, writeResearchNote } from "../client/src/lib/hadithStorage";
import type { HadithAnalysis } from "../shared/hadith";

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) });

const analysis: HadithAnalysis = { matn: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ", grade: "صحيح", gradeType: "صحيح", summary: "ملخص", confidenceNote: "تنبيه", sources: [], isnadStudy: [], matnStudy: [], scholars: [], caution: "ملاحظة" };

afterEach(() => memory.clear());

describe("تخزين ملف الحديث محلياً", () => {
  it("ينشئ سجلاً له معرف ووقت فحص", () => {
    const record = makeStoredHadith(analysis);
    expect(record.matn).toBe(analysis.matn);
    expect(record.id).toBeTruthy();
    expect(record.checkedAt).toBeTypeOf("number");
  });
  it("يحفظ ملاحظة الباحث ويستعيدها بمعرف الملف", () => {
    writeResearchNote("record-1", "راجع موضع العزو في المصدر.");
    expect(loadResearchNotes()).toEqual({ "record-1": "راجع موضع العزو في المصدر." });
  });
});
