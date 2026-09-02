// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const exportCard = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/hooks/useHadithExport", () => ({ useHadithExport: () => ({ exporting: null, exportCard }) }));

import { SavedPanel } from "../client/src/components/SavedPanel";
import { ResultCard } from "../client/src/components/ResultCard";
import type { StoredHadith } from "../shared/hadith";

const longItem: StoredHadith = { id: "long", checkedAt: 1_700_000_000_000, matn: "من قرأ بالآيتين من آخر سورة البقرة في ليلة كفتاه، وهذا نص طويل جداً للتحقق من بقاء المتن داخل حدود البطاقة على شاشة الهاتف الصغيرة", grade: "صحيح", gradeType: "درجة مفصلة مختلفة في بعض طرق الحديث الطويلة", summary: "", confidenceNote: "", sources: [], isnadStudy: [], matnStudy: [], scholars: [], turuq: [], caution: "" };

describe("احتواء بطاقات الحديث على الهاتف", () => {
  it("يفرض طي المتن الطويل والتفاف معلومات الدرجة والتاريخ داخل بطاقة محفوظة", () => {
    render(<SavedPanel history={[longItem]} favorites={[longItem]} onSelect={vi.fn()} onRemoveFavorite={vi.fn()} />);
    expect(screen.getAllByText(longItem.matn)[0]).toHaveClass("saved-hadith-matn");
    expect(screen.getAllByText(longItem.grade)[0]).toHaveClass("saved-grade");
  });
  it("يضيف فئات احتواء للمتن والدرجة الطويلة في بطاقة النتيجة", () => {
    const view = render(<ResultCard result={longItem} favorite={false} onToggleFavorite={vi.fn()} />);
    expect(view.container.querySelector(".hadith-safe-text")).toHaveTextContent(longItem.matn);
    expect(view.container.querySelector(".hadith-grade-badge .break-words")).toHaveTextContent(longItem.grade);
    const detail = view.container.querySelector(".hadith-grade-detail");
    expect(detail).toHaveTextContent(longItem.gradeType);
    expect(detail?.parentElement?.tagName).toBe("DIV");
  });
  it("يشغّل مساري PNG وPDF من أزرار بطاقة النتيجة", () => {
    exportCard.mockClear();
    const view = render(<ResultCard result={longItem} favorite={false} onToggleFavorite={vi.fn()} />);
    fireEvent.click(within(view.container).getByRole("button", { name: "تنزيل صورة" }));
    fireEvent.click(within(view.container).getByRole("button", { name: "تنزيل PDF" }));
    expect(exportCard).toHaveBeenNthCalledWith(1, "png");
    expect(exportCard).toHaveBeenNthCalledWith(2, "pdf");
  });
});
