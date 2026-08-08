import { DASHBOARD_MANUAL, type ManualEntry } from "@/content/dashboard-manual";

export type DashboardAssistantReply = {
  text: string;
  links?: { label: string; href: string }[];
};

// Same philosophy as src/lib/assistant-engine.ts (the public-site
// assistant): a local, rule-based matcher grounded only in the manual
// content in dashboard-manual.ts, never inventing an answer. Keeping the
// manual accurate is what keeps this accurate — there's no separate
// "knowledge" to fall out of sync.

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "do", "does", "did", "how", "what", "where", "when", "why", "who",
  "can", "i", "my", "me", "to", "for", "of", "in", "on", "at", "and", "or", "it", "this", "that", "you", "your",
  "with", "from", "about", "there", "here", "please", "up", "down",
]);

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

// Every answer includes who-sees-what, not just what the page does — the
// most-asked follow-up question is "why do I see something different
// than they do," so it's always in the same reply rather than something
// you have to separately ask about.
function formatEntryReply(entry: ManualEntry): string {
  return `${entry.details}\n\nWho sees this: ${entry.access}`;
}

function scoreEntry(tokens: string[], entry: ManualEntry): number {
  const haystack = `${entry.title} ${entry.summary} ${entry.details} ${(entry.keywords ?? []).join(" ")}`.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (haystack.includes(t)) score += 1;
    // A hit in the title counts extra — "payroll" should beat a page that
    // only mentions payroll once in passing.
    if (entry.title.toLowerCase().includes(t)) score += 2;
  }
  return score;
}

// A few explicit disambiguators for page pairs that share most of their
// vocabulary (both are legitimately about "leave", both about
// "invoices") and would otherwise tie on plain keyword overlap — these
// run first and short-circuit straight to the right one when the
// phrasing is unambiguous.
const DISAMBIGUATORS: { re: RegExp; path: string }[] = [
  { re: /approve|reject|review.*(leave|correction)/i, path: "/dashboard/admin/leave-requests" },
  { re: /apply for leave|request (leave|time off)/i, path: "/dashboard/leave" },
  { re: /generate (payslip|payroll|salary)/i, path: "/dashboard/admin/payroll" },
  { re: /my (payslip|salary)/i, path: "/dashboard/payslips" },
  { re: /credit note|debit note|gst invoice|proforma|ad.?hoc invoice/i, path: "/dashboard/invoice-crm" },
  { re: /pay.*(invoice|outstanding)|download.*invoice/i, path: "/dashboard/invoices" },
  { re: /approve.*account|pending (account|request)/i, path: "/dashboard/admin/account-requests" },
  { re: /reviewed (account|request)|approved.*account|rejected.*account/i, path: "/dashboard/admin/reviewed-account-requests" },
];

export function getDashboardAssistantReply(query: string): DashboardAssistantReply {
  const q = query.trim();
  if (!q) {
    return { text: "Ask me what a page is for, or how to do something — e.g. \"how do I approve leave\" or \"where do I record a payment\"." };
  }

  for (const d of DISAMBIGUATORS) {
    if (d.re.test(q)) {
      const entry = DASHBOARD_MANUAL.find((e) => e.path === d.path);
      if (entry) {
        return { text: formatEntryReply(entry), links: [{ label: `Open ${entry.title}`, href: entry.path }] };
      }
    }
  }

  const tokens = tokenize(q);
  if (tokens.length === 0) {
    return {
      text: "I couldn't match that to a specific page — try naming what you're trying to do, e.g. \"generate a payslip\" or \"add a lead\".",
    };
  }

  const scored = DASHBOARD_MANUAL.map((entry) => ({ entry, score: scoreEntry(tokens, entry) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      text: "I couldn't find a page for that in the manual yet. Try rephrasing, or browse the sidebar — Sales & Billing, My Workspace, Team Management, Administration, and Account cover everything.",
    };
  }

  const best = scored[0];
  // A close runner-up is worth surfacing too, rather than silently
  // guessing between two genuinely plausible pages.
  const runnerUp = scored[1] && scored[1].score >= best.score - 1 ? scored[1].entry : null;

  const links = [{ label: `Open ${best.entry.title}`, href: best.entry.path }];
  if (runnerUp) links.push({ label: `Or did you mean ${runnerUp.title}?`, href: runnerUp.path });

  return { text: formatEntryReply(best.entry), links };
}
