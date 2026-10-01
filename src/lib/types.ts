export type JobStatus = "none" | "pending" | "done" | "failed" | "skipped";
export type ConclusionVerdict = "stayed_true" | "partly" | "drifted" | "not_enough_data";

export type EntryAnalysis = {
  topics?: { topic: string; stance: string; evidence: string }[];
  tone?: string[];
  model?: string;
};

export type Layout = {
  /** width / height of the original photo */
  ar: number;
  /** Placement in units of canvas width (0-100). Missing = not placed yet (auto-arranged). */
  x?: number;
  y?: number;
  /** frame width in units of canvas width */
  w?: number;
  /** rotation in degrees */
  r?: number;
  /** stacking order */
  z?: number;
};

export type Month = {
  id: string;
  year: number;
  month: number;
  title: string | null;
  cover_image_key: string | null;
  month_end_reflection: string | null;
  how_it_changed_me: string | null;
  is_retrospective: boolean;
  sealed_at: string | null;
  themes: string[];
  ai_conclusion: string | null;
  ai_conclusion_verdict: ConclusionVerdict | null;
  ai_conclusion_status: JobStatus;
  ai_conclusion_at: string | null;
};

export type Influence = {
  id: string;
  month_id: string;
  name: string;
  image_key: string | null;
  why_it_resonates: string | null;
  date_added: string;
  source_note: string | null;
  themes: string[];
  traits: string[];
  suggested_traits: string[];
  traits_confidence: "high" | "medium" | "low" | null;
  traits_status: "none" | "pending" | "suggested" | "done" | "failed" | "skipped" | "declined";
};

export type Entry = {
  id: string;
  date: string;
  month_id: string;
  rating: number | null;
  note: string | null;
  weigh_in: number | null;
  influence_ids: string[];
  character_score: number | null;
  insight: string | null;
  insight_status: JobStatus;
  insight_at: string | null;
  analysis: EntryAnalysis | null;
  scores: { influence_id: string; score: number; note: string | null }[];
};

export type Photo = {
  id: string;
  entry_id: string | null;
  influence_id: string | null;
  month_id: string | null;
  storage_key: string;
  is_progress_photo: boolean;
  is_hidden: boolean;
  layout: Layout | null;
  created_at: string;
};
