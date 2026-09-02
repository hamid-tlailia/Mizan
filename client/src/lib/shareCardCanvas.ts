import type { HadithAnalysis } from "@shared/hadith";

const CARD_WIDTH = 1080;
const CONTENT_INSET = 72;
const BODY_WIDTH = CARD_WIDTH - CONTENT_INSET * 2;

export type ShareCardExportContent = {
  matn: string;
  grade: string;
  gradeType: string;
  summary: string;
  caution: string;
};

export function getShareCardExportContent(result: HadithAnalysis): ShareCardExportContent {
  return {
    matn: result.matn.length > 460 ? `${result.matn.slice(0, 460).trim()}…` : result.matn,
    grade: result.grade,
    gradeType: result.gradeType,
    summary: result.summary,
    caution: "هذه نتيجة مساعدة للبحث؛ تُراجع المصادر وأهل الاختصاص عند الحاجة.",
  };
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("تعذّر تجهيز لوحة الصورة.");
  context.direction = "rtl";
  return context;
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && context.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.closePath();
}

function drawLines(context: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
}

/** يرسم بطاقة مستقلة تماماً عن CSS الصفحة حتى تبقى صورة التصدير كاملة في كل المتصفحات. */
export function createShareCardCanvas(result: HadithAnalysis): HTMLCanvasElement {
  const content = getShareCardExportContent(result);
  const measureCanvas = document.createElement("canvas");
  const measure = getContext(measureCanvas);
  measure.font = "700 42px 'Noto Naskh Arabic', Arial, sans-serif";
  const matnLines = wrapText(measure, content.matn, BODY_WIDTH);
  measure.font = "400 28px 'Noto Sans Arabic', Arial, sans-serif";
  const gradeTypeLines = wrapText(measure, content.gradeType, BODY_WIDTH - 250);
  const summaryLines = wrapText(measure, content.summary, BODY_WIDTH);
  const footerLines = wrapText(measure, content.caution, BODY_WIDTH);

  const headerHeight = 188;
  const matnHeight = Math.max(170, matnLines.length * 74 + 54);
  const gradeHeight = Math.max(94, gradeTypeLines.length * 46 + 46);
  const summaryHeight = Math.max(96, summaryLines.length * 48 + 48);
  const footerHeight = Math.max(82, footerLines.length * 36 + 36);
  const height = headerHeight + 48 + 40 + matnHeight + 30 + gradeHeight + 30 + summaryHeight + 48 + footerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = height;
  const context = getContext(canvas);
  context.fillStyle = "#fbfaf3";
  context.fillRect(0, 0, CARD_WIDTH, height);

  context.fillStyle = "#0b4a31";
  roundRect(context, 0, 0, CARD_WIDTH, headerHeight, 34);
  context.fill();
  context.fillStyle = "#e5c56f";
  context.font = "700 50px Arial, sans-serif";
  context.textAlign = "left";
  context.fillText("⚖", 100, 112);
  context.textAlign = "right";
  context.fillStyle = "#fff9e8";
  context.font = "700 44px 'Noto Naskh Arabic', Arial, sans-serif";
  context.fillText("ميزان الحديث", CARD_WIDTH - CONTENT_INSET, 82);
  context.fillStyle = "#c7dfcc";
  context.font = "400 25px 'Noto Sans Arabic', Arial, sans-serif";
  context.fillText("نتيجة فحص وتخريج مبدئية", CARD_WIDTH - CONTENT_INSET, 128);

  let cursor = headerHeight + 48;
  context.textAlign = "right";
  context.fillStyle = "#5b6a5e";
  context.font = "700 25px 'Noto Sans Arabic', Arial, sans-serif";
  context.fillText("متن الحديث", CARD_WIDTH - CONTENT_INSET, cursor);
  cursor += 38;
  context.fillStyle = "#23352c";
  context.font = "700 42px 'Noto Naskh Arabic', Arial, sans-serif";
  context.textAlign = "center";
  drawLines(context, matnLines, CARD_WIDTH / 2, cursor + 34, 74);
  cursor += matnHeight;

  context.fillStyle = "#f2f5ef";
  roundRect(context, CONTENT_INSET, cursor, BODY_WIDTH, gradeHeight, 22);
  context.fill();
  context.fillStyle = "#17633d";
  roundRect(context, CARD_WIDTH - CONTENT_INSET - 210, cursor + 20, 190, 52, 26);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "700 28px 'Noto Sans Arabic', Arial, sans-serif";
  context.textAlign = "center";
  context.fillText(content.grade, CARD_WIDTH - CONTENT_INSET - 115, cursor + 55);
  context.fillStyle = "#43564a";
  context.font = "400 28px 'Noto Sans Arabic', Arial, sans-serif";
  context.textAlign = "right";
  drawLines(context, gradeTypeLines, CARD_WIDTH - CONTENT_INSET - 238, cursor + 48, 46);
  cursor += gradeHeight + 30;

  context.strokeStyle = "#e5e0d4";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(CONTENT_INSET, cursor);
  context.lineTo(CARD_WIDTH - CONTENT_INSET, cursor);
  context.stroke();
  cursor += 42;
  context.fillStyle = "#526158";
  context.font = "400 28px 'Noto Sans Arabic', Arial, sans-serif";
  context.textAlign = "right";
  drawLines(context, summaryLines, CARD_WIDTH - CONTENT_INSET, cursor, 48);
  cursor += summaryHeight;

  context.fillStyle = "#f4f0e6";
  context.fillRect(0, height - footerHeight, CARD_WIDTH, footerHeight);
  context.fillStyle = "#67756b";
  context.font = "400 23px 'Noto Sans Arabic', Arial, sans-serif";
  context.textAlign = "center";
  drawLines(context, footerLines, CARD_WIDTH / 2, height - footerHeight + 42, 36);
  return canvas;
}
