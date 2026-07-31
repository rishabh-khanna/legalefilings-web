// Shared by every attendance view (staff self-view, admin team view, the
// PDF report) so "how long was this shift" always reads the same way —
// hours and minutes, not a decimal fraction of an hour that's meaningless
// at a glance (e.g. "0.1" for a 6-minute shift).
export function formatHoursMinutes(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
