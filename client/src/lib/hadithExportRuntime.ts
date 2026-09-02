import { getHadithExportFilename, type HadithExportExtension } from "@shared/hadithExport";

const UNSUPPORTED_COLOR_FUNCTION = /(?:oklch|oklab|lab|lch|color-mix|color)\s*\(/i;
const EXPORT_COLOR_FALLBACKS: Record<string, string> = {
  color: "#23352c",
  "background-color": "transparent",
  background: "#fbfaf3",
  "background-image": "none",
  "border-color": "#d9d5c7",
  "border-top-color": "#d9d5c7",
  "border-right-color": "#d9d5c7",
  "border-bottom-color": "#d9d5c7",
  "border-left-color": "#d9d5c7",
  "outline-color": "#23352c",
  "text-decoration-color": "#23352c",
  "caret-color": "#23352c",
  "column-rule-color": "#23352c",
  "box-shadow": "none",
  "text-shadow": "none",
  fill: "#23352c",
  stroke: "#23352c",
};
const COLOR_PROPERTIES = Object.keys(EXPORT_COLOR_FALLBACKS);

export function isUnsupportedExportColor(value: string): boolean {
  return UNSUPPORTED_COLOR_FUNCTION.test(value);
}

function getExportFallback(property: string): string {
  if (property === "background-image") return "none";
  if (property === "background") return "#fbfaf3";
  if (property.includes("shadow")) return "none";
  if (property.includes("border")) return "#d9d5c7";
  if (property === "fill" || property === "stroke") return "#23352c";
  return "#23352c";
}

/**
 * html2canvas لا يدعم ألوان CSS الحديثة مثل OKLCH. تُطبق هذه الدالة على
 * نسخة التصدير فقط، فلا يتغير مظهر التطبيق الأصلي أو وضعه الداكن.
 */
export function sanitizeExportColors(root: HTMLElement): void {
  const view = root.ownerDocument.defaultView;
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  for (const node of nodes) {
    const computed = view?.getComputedStyle(node);
    const properties = new Set([
      ...COLOR_PROPERTIES,
      ...Array.from(computed ?? []).filter(property => !property.startsWith("--")),
    ]);
    for (const property of Array.from(properties)) {
      const value = computed?.getPropertyValue(property) || node.style.getPropertyValue(property);
      if (value && isUnsupportedExportColor(value)) {
        node.style.setProperty(property, EXPORT_COLOR_FALLBACKS[property] ?? getExportFallback(property), "important");
      }
    }
  }
}

/**
 * ينسخ html2canvas المستند كاملاً قبل التقاط البطاقة. لذلك لا يكفي تعقيم
 * البطاقة وحدها حين تأتي ألوان OKLCH من خلفية الصفحة أو ظلالها الموروثة.
 */
export function sanitizeExportDocument(document: Document): void {
  const root = document.documentElement;
  if (root) sanitizeExportColors(root);
}

export type ExportCanvas = {
  width: number;
  height: number;
  toDataURL: (type?: string, quality?: number) => string;
  toBlob: (callback: (blob: Blob | null) => void, type?: string, quality?: number) => void;
};

export type PdfDocument = { addImage: (...args: any[]) => unknown; save: (filename: string) => unknown };
export type PdfFactory = (options: { orientation: "portrait" | "landscape"; unit: "px"; format: [number, number]; compress: boolean }) => PdfDocument;

export function canvasToPngBlob(canvas: ExportCanvas): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("تعذّر إنشاء ملف الصورة.")), "image/png", 1));
}

export function createPdfFromCanvas(canvas: ExportCanvas, makePdf: PdfFactory): void {
  const pdf = makePdf({ orientation: canvas.width > canvas.height ? "landscape" : "portrait", unit: "px", format: [canvas.width, canvas.height], compress: true });
  pdf.addImage(canvas.toDataURL("image/png", 1), "PNG", 0, 0, canvas.width, canvas.height, undefined, "FAST");
  pdf.save(getHadithExportFilename("pdf"));
}

type DownloadAnchor = { href: string; download: string; click: () => void; remove: () => void };
type DownloadEnvironment = { document: { createElement: (tag: string) => DownloadAnchor; body: { appendChild: (node: DownloadAnchor) => void } }; URL: { createObjectURL: (blob: Blob) => string; revokeObjectURL: (url: string) => void } };

function getBrowserDownloadEnvironment(): DownloadEnvironment {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function" || typeof URL.revokeObjectURL !== "function") {
    throw new Error("التنزيل متاح من المتصفح فقط.");
  }
  return { document: document as unknown as DownloadEnvironment["document"], URL };
}

export function downloadExportBlob(blob: Blob, extension: HadithExportExtension, environment?: DownloadEnvironment) {
  const target = environment ?? getBrowserDownloadEnvironment();
  const anchor = target.document.createElement("a");
  anchor.href = target.URL.createObjectURL(blob);
  anchor.download = getHadithExportFilename(extension);
  target.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => target.URL.revokeObjectURL(anchor.href), 1_000);
}
