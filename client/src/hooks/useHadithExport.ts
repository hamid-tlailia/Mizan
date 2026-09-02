import type { HadithExportExtension } from "@shared/hadithExport";
import type { HadithAnalysis } from "@shared/hadith";
import { canvasToPngBlob, createPdfFromCanvas, downloadExportBlob, type ExportCanvas, type PdfFactory } from "@/lib/hadithExportRuntime";
import { createShareCardCanvas } from "../lib/shareCardCanvas";
import { jsPDF } from "jspdf";
import { useState } from "react";

type ExportKind = HadithExportExtension | null;

type ExportActions = {
  makePngBlob: (canvas: ExportCanvas) => Promise<Blob>;
  downloadPng: (blob: Blob) => void;
  makePdf: (canvas: ExportCanvas) => void;
};

export async function runCardExport(kind: HadithExportExtension, capture: () => Promise<ExportCanvas>, actions?: ExportActions): Promise<void> {
  const canvas = await capture();
  const resolved = actions ?? {
    makePngBlob: canvasToPngBlob,
    downloadPng: blob => downloadExportBlob(blob, "png"),
    makePdf: value => createPdfFromCanvas(value, options => new jsPDF(options) as unknown as ReturnType<PdfFactory>),
  };
  if (kind === "png") {
    resolved.downloadPng(await resolved.makePngBlob(canvas));
  } else {
    resolved.makePdf(canvas);
  }
}

export function useHadithExport(result: HadithAnalysis) {
  const [exporting, setExporting] = useState<ExportKind>(null);

  const captureCard = async () => {
    await document.fonts?.ready;
    return createShareCardCanvas(result) as unknown as ExportCanvas;
  };

  const exportCard = async (kind: HadithExportExtension) => {
    setExporting(kind);
    try {
      await runCardExport(kind, captureCard);
    } finally {
      setExporting(null);
    }
  };

  return { exporting, exportCard };
}
