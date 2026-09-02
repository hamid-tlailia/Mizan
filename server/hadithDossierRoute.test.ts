import { describe, expect, it } from "vitest";
import { getHadithDossierPath, isDossierPath } from "../shared/hadithDossierRoute";

describe("مسار ملف الحديث", () => {
  it("ينشئ مساراً مستقلاً لنتيجة محفوظة", () => {
    expect(getHadithDossierPath("record 1")).toBe("/hadith/record%201");
  });
  it("يميّز مسار ملف الحديث الصحيح", () => {
    expect(isDossierPath("/hadith/record-1")).toBe(true);
    expect(isDossierPath("/hadith/")).toBe(false);
  });
});
