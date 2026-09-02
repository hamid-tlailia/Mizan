import { describe, expect, it } from "vitest";
import { getHadithExportFilename } from "../shared/hadithExport";

describe("اسم ملف تصدير الحديث", () => {
  it("ينشئ اسماً متوقعاً لصورة بطاقة المشاركة", () => {
    expect(getHadithExportFilename("png", new Date("2026-08-22T12:00:00.000Z"))).toBe("mizan-alhadith-2026-08-22.png");
  });

  it("ينشئ اسماً متوقعاً لملف PDF", () => {
    expect(getHadithExportFilename("pdf", new Date("2026-08-22T12:00:00.000Z"))).toBe("mizan-alhadith-2026-08-22.pdf");
  });
});
