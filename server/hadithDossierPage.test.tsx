// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoredHadith } from "../shared/hadith";

const navigate = vi.fn();
let routeParams: { id: string } | null = null;
let storedRecords: StoredHadith[] = [];
let researchData: Record<string, unknown> = { sourceNotice: "تنبيه", searchedCollections: [], hits: [], unavailableCollections: [], searchedTerms: [], narrators: [] };

vi.mock("wouter", () => ({
  useLocation: () => ["/", navigate],
  useRoute: () => [Boolean(routeParams), routeParams],
}));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }) }));
vi.mock("@/components/HadithSearch", () => ({ HadithSearch: ({ onSubmit }: { onSubmit: () => void }) => <button onClick={onSubmit}>فحص الاختبار</button> }));
vi.mock("@/components/AnalysisSkeleton", () => ({ AnalysisSkeleton: () => <div /> }));
vi.mock("@/components/SavedPanel", () => ({ SavedPanel: () => <div /> }));
vi.mock("@/components/ResultCard", () => ({ ResultCard: () => <div>بطاقة النتيجة</div> }));
vi.mock("@/lib/hadithService", () => ({ validateHadithRequest: () => null, useHadithAnalysisService: () => ({ isPending: false, analyze: (_text: string, callbacks: { onSuccess: (value: unknown) => void }) => callbacks.onSuccess({ matn: "نص اختبار", grade: "صحيح", gradeType: "صحيح", summary: "ملخص", confidenceNote: "تنبيه", sources: [], isnadStudy: [], matnStudy: [], scholars: [], caution: "ملاحظة" }) }) }));
vi.mock("@/lib/hadithStorage", () => ({
  HISTORY_KEY: "history", FAVORITES_KEY: "favorites", NOTES_KEY: "notes",
  loadStoredHadith: () => storedRecords, saveStoredHadith: vi.fn(), limitStored: <T,>(items: T[]) => items,
  makeStoredHadith: (value: Record<string, unknown>) => ({ ...value, id: "record-1", checkedAt: 123 }),
  loadResearchNotes: () => ({}), writeResearchNote: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({ trpc: { hadith: { research: { useQuery: () => ({ data: researchData, isLoading: false, isError: false }) } } } }));

import Home from "../client/src/pages/Home";
import HadithDossier from "../client/src/pages/HadithDossier";

afterEach(() => { navigate.mockClear(); routeParams = null; storedRecords = []; researchData = { sourceNotice: "تنبيه", searchedCollections: [], hits: [], unavailableCollections: [], searchedTerms: [], narrators: [] }; });

describe("مسار ملف الحديث في الواجهة", () => {
  it("ينتقل من نجاح الفحص إلى مسار ملف الحديث", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "فحص الاختبار" }));
    expect(navigate).toHaveBeenCalledWith("/hadith/record-1");
  });
  it("يعرض حالة واضحة عند فتح ملف غير موجود محلياً", () => {
    routeParams = { id: "missing" };
    render(<HadithDossier />);
    expect(screen.getByText("لم يُعثر على ملف الحديث")).toBeInTheDocument();
  });
  it("يعرض مراجع جرح وتعديل موثقة ويخفي نتائج البحث غير المستقرة", () => {
    const record: StoredHadith = { id: "mobile-record", checkedAt: 1_700_000_000_000, matn: "متن حديث طويل للاختبار", grade: "صحيح", gradeType: "صحيح", summary: "ملخص", confidenceNote: "تنبيه", sources: [], isnadStudy: [], matnStudy: [], scholars: [], caution: "ملاحظة" };
    const longText = "هذا نص مصدر طويل جداً للتحقق من بقائه داخل بطاقة ملف الحديث على شاشة الهاتف مهما امتدت العبارة وتكررت البيانات المصدرية";
    routeParams = { id: record.id }; storedRecords = [record];
    researchData = { sourceNotice: longText, searchedCollections: ["bukhari"], unavailableCollections: [], searchedTerms: ["نص"], narrators: [], hits: [{ hadithKey: "bukhari:1", collection: "bukhari", hadithNumber: "1", text: longText, similarity: 100, grade: "صحيح", grader: longText, gradeSource: longText, attributionText: longText }] };
    const view = render(<HadithDossier />);
    expect(view.container.querySelector(".research-dossier-card")).toBeInTheDocument();
    expect(view.container.querySelector(".dataset-link")).toBeInTheDocument();
    expect(view.container.querySelector(".source-disclaimer")).toHaveTextContent("أزيلت طبقة البحث النصي");
    expect(view.container.querySelectorAll(".corpus-book")).toHaveLength(2);
    expect(view.container.querySelector(".narrator-limit")).toHaveTextContent("لا توجد حالياً قاعدة رواة مرخّصة");
    const styles = readFileSync("/home/ubuntu/hadith-verifier/client/src/index.css", "utf8");
    expect(styles).toContain(".dataset-link { overflow-wrap: anywhere");
    expect(styles).toContain(".source-disclaimer { overflow-wrap: anywhere");
  });
});
