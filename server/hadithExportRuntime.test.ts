// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { runCardExport } from "../client/src/hooks/useHadithExport";
import { canvasToPngBlob, createPdfFromCanvas, downloadExportBlob, isUnsupportedExportColor, sanitizeExportColors, type ExportCanvas } from "../client/src/lib/hadithExportRuntime";
import { createShareCardCanvas, getShareCardExportContent } from "../client/src/lib/shareCardCanvas";
import type { HadithAnalysis } from "../shared/hadith";

const canvas: ExportCanvas = {
  width: 900,
  height: 1200,
  toDataURL: vi.fn(() => "data:image/png;base64,card"),
  toBlob: vi.fn(callback => callback(new Blob(["card"], { type: "image/png" }))),
};

const exportResult: HadithAnalysis = { matn: "متن مختصر", grade: "صحيح", gradeType: "صحيح لذاته", summary: "خلاصة الاختبار", confidenceNote: "تنبيه", sources: [], isnadStudy: [], matnStudy: [], scholars: [], turuq: [], caution: "تنبيه" };

describe("التصدير التشغيلي لبطاقة الحديث", () => {
  it("ينشئ Blob لصورة PNG ثم يطلق تنزيلها", async () => {
    const blob = await canvasToPngBlob(canvas);
    const anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    const environment = { document: { createElement: vi.fn(() => anchor), body: { appendChild: vi.fn() } }, URL: { createObjectURL: vi.fn(() => "blob:card"), revokeObjectURL: vi.fn() } };
    downloadExportBlob(blob, "png", environment);
    expect(blob.type).toBe("image/png");
    expect(anchor.download).toMatch(/^mizan-alhadith-\d{4}-\d{2}-\d{2}\.png$/);
    expect(anchor.click).toHaveBeenCalledOnce();
  });

  it("ينشئ ملف PDF عمودياً ويضيف بطاقة الصورة ثم ينزله", () => {
    const pdf = { addImage: vi.fn(), save: vi.fn() };
    const factory = vi.fn(() => pdf);
    createPdfFromCanvas(canvas, factory);
    expect(factory).toHaveBeenCalledWith(expect.objectContaining({ orientation: "portrait", format: [900, 1200] }));
    expect(pdf.addImage).toHaveBeenCalledWith("data:image/png;base64,card", "PNG", 0, 0, 900, 1200, undefined, "FAST");
    expect(pdf.save).toHaveBeenCalledWith(expect.stringMatching(/^mizan-alhadith-\d{4}-\d{2}-\d{2}\.pdf$/));
  });

  it("يعرض خطأً عربياً عند تعذر إنشاء Blob لصورة البطاقة", async () => {
    const brokenCanvas: ExportCanvas = { ...canvas, toBlob: vi.fn(callback => callback(null)) };
    await expect(canvasToPngBlob(brokenCanvas)).rejects.toThrow("تعذّر إنشاء ملف الصورة.");
  });

  it("يرفض التنزيل خارج بيئة المتصفح برسالة مفهومة", () => {
    expect(() => downloadExportBlob(new Blob(["card"]), "png")).toThrow("التنزيل متاح من المتصفح فقط.");
  });

  it("يمرر فشل إنشاء PDF لتلتقطه واجهة المستخدم وتعرض التنبيه", () => {
    expect(() => createPdfFromCanvas(canvas, () => { throw new Error("تعذّر تجهيز ملف PDF."); })).toThrow("تعذّر تجهيز ملف PDF.");
  });

  it("يتعرف على دوال الألوان الحديثة غير المدعومة في محرك التصدير", () => {
    expect(isUnsupportedExportColor("oklch(0.7 0.1 155)")).toBe(true);
    expect(isUnsupportedExportColor("color-mix(in srgb, red, white)")).toBe(true);
    expect(isUnsupportedExportColor("#0b4a31")).toBe(false);
    expect(isUnsupportedExportColor("rgb(11, 74, 49)")).toBe(false);
  });

  it("يعقم ألوان OKLCH وcolor-mix في نسخة البطاقة دون تغيير النص أو البنية", () => {
    const card = document.createElement("article");
    const badge = document.createElement("span");
    card.textContent = "متن الحديث";
    card.style.setProperty("color", "oklch(0.7 0.1 155)");
    badge.style.setProperty("border-color", "color-mix(in srgb, red, white)");
    badge.style.setProperty("border-block-start-color", "oklch(0.7 0.1 155)");
    card.appendChild(badge);
    sanitizeExportColors(card);
    expect(card.textContent).toBe("متن الحديث");
    expect(card.style.getPropertyValue("color")).toBe("rgb(35, 53, 44)");
    expect(badge.style.getPropertyValue("border-color")).toBe("rgb(217, 213, 199)");
    expect(badge.style.getPropertyValue("border-block-start-color")).toBe("rgb(217, 213, 199)");
  });

  it("يبني محتوى بطاقة تصدير مستقل يحتفظ بالنص والدرجة والخلاصة دون الاعتماد على DOM الصفحة", () => {
    expect(getShareCardExportContent(exportResult)).toEqual(expect.objectContaining({ matn: "متن مختصر", grade: "صحيح", gradeType: "صحيح لذاته", summary: "خلاصة الاختبار" }));
  });

  it("يرسم مولد Canvas عناصر البطاقة الأساسية على لوحة ذات أبعاد ثابتة", () => {
    const context = {
      direction: "rtl",
      font: "",
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      textAlign: "right",
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn((text: string) => ({ width: text.length * 15 })),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    };
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const card = createShareCardCanvas(exportResult);
    expect(card.width).toBe(1080);
    expect(card.height).toBeGreaterThan(500);
    expect(context.fillRect).toHaveBeenCalled();
    expect(context.fillText).toHaveBeenCalledWith("ميزان الحديث", expect.any(Number), expect.any(Number));
    expect(context.fillText).toHaveBeenCalledWith("متن مختصر", expect.any(Number), expect.any(Number));
    expect(context.fillText).toHaveBeenCalledWith("صحيح", expect.any(Number), expect.any(Number));
    getContext.mockRestore();
  });

  it("يشغّل تنزيل PNG وحفظ PDF عبر المسارين الفعليين بعد تجهيز canvas البطاقة", async () => {
    const pngBlob = new Blob(["card"], { type: "image/png" });
    const actions = { makePngBlob: vi.fn(async () => pngBlob), downloadPng: vi.fn(), makePdf: vi.fn() };
    const capture = vi.fn(async () => canvas);
    await runCardExport("png", capture, actions);
    await runCardExport("pdf", capture, actions);
    expect(capture).toHaveBeenCalledTimes(2);
    expect(actions.makePngBlob).toHaveBeenCalledWith(canvas);
    expect(actions.downloadPng).toHaveBeenCalledWith(pngBlob);
    expect(actions.makePdf).toHaveBeenCalledWith(canvas);
  });
});
