// Shared between the /api/leads route and the admin dashboard so the lead
// shape, stage list, and staff directory exist in exactly one place. No
// server-only imports here (no fs/path) — this file is safe to import from
// client components too.

export const LEAD_STAGES = ["new", "contacted", "in_progress", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  in_progress: "In Progress",
  won: "Won",
  lost: "Lost",
};

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city?: string;
  state: string;
  service?: string;
  /** Which pricing tier was selected when the lead was submitted, if any — the same field a future payment/checkout step would key off of. */
  plan?: string;
  planPrice?: string;
  message?: string;
  createdAt: string;
  stage: LeadStage;
  assignedTo: string;
  notes: string;
};
