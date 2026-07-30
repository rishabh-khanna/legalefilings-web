import type { SearchEntry } from "@/lib/content";
import { STRUCTURE_COMPARISON } from "@/content/structure-comparison";

export type AssistantReply = {
  text: string;
  links?: { label: string; href: string }[];
};

const ELIGIBILITY_RE = /which (structure|entity|company type)|what (structure|entity)|should i (register|choose|start|form)|best (structure|entity)|difference between|compare structures?/i;
const PRICE_RE = /price|pricing|cost|fee|charges?|how much/i;
const DOCUMENT_RE = /documents?( required)?|paperwork|what.*(do i|would i|will i).*need/i;

// This is a local, rule-based stand-in — grounded only in real content
// already on the site (the search index + the structure-comparison table),
// never inventing a fact. It's intentionally honest about being simple
// rather than pretending to be a general-purpose AI. Swapping in a real
// model later just means changing what this function does internally; the
// call site (AiAssistant.tsx) doesn't need to change.
export function getAssistantReply(query: string, index: SearchEntry[]): AssistantReply {
  const q = query.trim().toLowerCase();
  if (!q) {
    return { text: "Ask me about a service, its pricing, or which business structure fits you." };
  }

  if (ELIGIBILITY_RE.test(q)) {
    const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
    const lines = STRUCTURE_COMPARISON.slice(0, 4)
      .map((s) => `• ${s.name} — best for ${lowerFirst(s.bestFor)}`)
      .join("\n");
    return {
      text: `Quick honest comparison (general guidance, not a substitute for advice on your specific situation):\n\n${lines}`,
      links: [{ label: "See the full comparison table", href: "/services/private-limited-company#compare-structures" }],
    };
  }

  const match = index.find((e) => q.includes(e.title.toLowerCase()) || e.title.toLowerCase().includes(q));
  if (match) {
    if (PRICE_RE.test(q)) {
      return {
        text: `${match.title} has live pricing on its page — tiers, what's included, and government fees are all listed there.`,
        links: [{ label: `${match.title} pricing`, href: `${match.href}#pricing` }],
      };
    }
    if (DOCUMENT_RE.test(q)) {
      return {
        text: `The documents required for ${match.title} are listed on its page.`,
        links: [{ label: `${match.title} — documents required`, href: match.href }],
      };
    }
    return {
      text: `Here's the ${match.title} page — process, pricing, and FAQs are all there.`,
      links: [{ label: `Open ${match.title}`, href: match.href }],
    };
  }

  if (PRICE_RE.test(q)) {
    return {
      text: 'Pricing depends on the service — tell me which one (e.g. "GST registration" or "Private Limited Company") and I\'ll point you to it.',
      links: [
        { label: "Private Limited Company pricing", href: "/services/private-limited-company#pricing" },
        { label: "GST Registration", href: "/services/gst-registration" },
      ],
    };
  }

  return {
    text: "I'm a simple assistant for now, so I might not catch everything — I can point you to a service, its pricing, or documents required. For anything specific to your situation, our CA/CS team can help directly.",
    links: [{ label: "Talk to a CA/CS expert", href: "/contact" }],
  };
}
