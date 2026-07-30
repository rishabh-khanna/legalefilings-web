// Client-side-only demo "session" — there's no backend yet (that's next),
// so this is just a localStorage flag gating the /dashboard demo. Not real
// auth: anyone can set this in devtools. Fine for a dummy to review before
// building the real thing, not fine to ship as-is.
const KEY = "demo-session";

export type DemoSession = { name: string; email: string };

export function getDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoSession;
  } catch {
    return null;
  }
}

export function setDemoSession(session: DemoSession) {
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearDemoSession() {
  window.localStorage.removeItem(KEY);
}
