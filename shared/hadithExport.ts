export type HadithExportExtension = "png" | "pdf";

export function getHadithExportFilename(extension: HadithExportExtension, now = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  return `mizan-alhadith-${date}.${extension}`;
}
