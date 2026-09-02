import { describe, expect, it } from "vitest";
import { getHadithGradeTone } from "../shared/hadithPresentation";

describe("منطق عرض درجة الحديث", () => {
  it("يعرض الصحيح بدرجة إيجابية", () => {
    expect(getHadithGradeTone("صحيح")).toBe("positive");
  });

  it("يعرض الضعيف والموضوع بدرجة سلبية", () => {
    expect(getHadithGradeTone("ضعيف")).toBe("negative");
    expect(getHadithGradeTone("موضوع")).toBe("negative");
  });

  it("يعرض الحسن والمختلف فيه بدرجة تنبيه", () => {
    expect(getHadithGradeTone("حسن")).toBe("caution");
    expect(getHadithGradeTone("مختلف فيه")).toBe("caution");
  });
});
