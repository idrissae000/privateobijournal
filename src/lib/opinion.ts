export type Verdict = "strong" | "good" | "mixed" | "weak";

export type Opinion = {
  verdict: Verdict;
  headline: string;
  /** how it fits this particular person, in the context of their history */
  fit: string;
  strengths: string[];
  concerns: string[];
  suggestions: string[];
  /** characters only: a short note per trait */
  trait_notes?: { trait: string; note: string }[];
  model?: string;
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  strong: "strong fit",
  good: "good fit",
  mixed: "mixed",
  weak: "weak fit",
};

export type OpinionRow = {
  subject_type: "month" | "character";
  subject_id: string;
  content: Partial<Opinion>;
  fingerprint: string | null;
  status: "pending" | "done" | "failed";
  generated_at: string;
};

/** A "pending" mark older than this means the background job died. */
export const STALE_PENDING_MS = 3 * 60_000;
export const isStalePending = (at: string) => Date.now() - new Date(at).getTime() > STALE_PENDING_MS;
