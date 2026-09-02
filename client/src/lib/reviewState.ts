export type ReviewStatus = "pending" | "verified" | "flagged" | "rejected";

export type ReviewEntry = {
  status: ReviewStatus;
  note: string;
  updatedAt: number;
};

export type ReviewMap = Record<string, ReviewEntry>;

const REVIEW_KEY_PREFIX = "mizan-hadith-review-";

function reviewKey(hadithId: string) {
  return `${REVIEW_KEY_PREFIX}${hadithId}`;
}

export function loadReview(hadithId: string): ReviewMap {
  try {
    const raw = localStorage.getItem(reviewKey(hadithId));
    return raw ? (JSON.parse(raw) as ReviewMap) : {};
  } catch {
    return {};
  }
}

export function saveReviewEntry(hadithId: string, claimId: string, status: ReviewStatus, note: string): ReviewMap {
  const current = loadReview(hadithId);
  const next: ReviewMap = { ...current, [claimId]: { status, note, updatedAt: Date.now() } };
  localStorage.setItem(reviewKey(hadithId), JSON.stringify(next));
  return next;
}

export function clearReviewEntry(hadithId: string, claimId: string): ReviewMap {
  const current = loadReview(hadithId);
  const next = { ...current };
  delete next[claimId];
  localStorage.setItem(reviewKey(hadithId), JSON.stringify(next));
  return next;
}

export type ReviewSummary = {
  total: number;
  verified: number;
  flagged: number;
  rejected: number;
  pending: number;
};

export function summarizeReview(map: ReviewMap, claimIds: string[]): ReviewSummary {
  const summary: ReviewSummary = { total: claimIds.length, verified: 0, flagged: 0, rejected: 0, pending: 0 };
  for (const id of claimIds) {
    const status = map[id]?.status ?? "pending";
    summary[status] += 1;
  }
  return summary;
}
