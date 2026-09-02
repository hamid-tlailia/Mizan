export function getHadithDossierPath(id: string): string { return `/hadith/${encodeURIComponent(id)}`; }
export function isDossierPath(path: string): boolean { return /^\/hadith\/[^/]+$/.test(path); }
