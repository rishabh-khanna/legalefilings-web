// In-memory sliding-window limiter for public, unauthenticated endpoints
// that create real Razorpay orders (checkout, invoice payment creation) —
// there was previously zero rate limiting on either. This is a best-effort
// mitigation, not a substitute for a real edge/WAF rate limit: Fluid
// Compute reuses warm instances across requests, so this catches a burst
// hitting the same instance, but the counters reset on cold start and
// aren't shared across instances or regions. Still meaningfully raises
// the bar against basic scripted abuse with zero new infra or migrations.
const buckets = new Map<string, number[]>();

// Bounds how many distinct keys (IPs) get tracked at once, so a
// distributed flood from many different IPs can't grow this map without
// limit for the lifetime of the warm instance.
const MAX_TRACKED_KEYS = 5000;

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    buckets.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  if (!buckets.has(key) && buckets.size >= MAX_TRACKED_KEYS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey !== undefined) buckets.delete(oldestKey);
  }
  buckets.set(key, timestamps);
  return false;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
