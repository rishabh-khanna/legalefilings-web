import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Profile } from "@/lib/roles";

// Everyone in `viewerId`'s reporting chain, walking `reports_to` down as
// far as it goes (rater -> leader -> group_leader is only ever 2 hops in
// this org, but this doesn't hardcode that depth). Used to scope what a
// leader/group_leader can see and approve to their own team, rather than
// the whole company — only admin gets unrestricted visibility.
export async function getReportingChainIds(viewerId: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const ids = new Set<string>();
  let frontier = [viewerId];

  while (frontier.length > 0) {
    const { data } = await supabase.from("profiles").select("id").in("reports_to", frontier);
    const next = (data ?? []).map((p) => p.id).filter((id) => !ids.has(id));
    next.forEach((id) => ids.add(id));
    frontier = next;
  }

  return Array.from(ids);
}

// Can `viewer` *see* `targetStaffId`'s attendance/leave/etc.? Admin can see
// anyone; a leader/group_leader can see anyone below them in the chain
// (their whole team, for oversight); everyone can see their own records.
// This is deliberately broader than who can *approve* something — see
// isDirectManagerOf below — a group_leader should be able to check in on
// a rater two levels down without that also letting them rubber-stamp
// that rater's leave request over the actual direct manager's head.
export async function canManageStaff(viewer: Pick<Profile, "id" | "account_type">, targetStaffId: string): Promise<boolean> {
  if (viewer.account_type === "admin") return true;
  if (viewer.id === targetStaffId) return true;
  const chain = await getReportingChainIds(viewer.id);
  return chain.includes(targetStaffId);
}

// Can `approver` actually approve/reject something `targetStaffId`
// submitted? Two rules, both load-bearing:
// - Never the requester themselves, at any level (including admin acting
//   on their own request) — approval has to come from someone else.
// - Otherwise: admin can approve anyone's; everyone else must be the
//   target's *direct* manager (reports_to = approver.id exactly) — one
//   level up, not any level up. A group_leader shouldn't be able to
//   skip past a rater's actual leader and approve the rater's leave
//   directly; that's the leader's call.
export async function canApproveFor(
  approver: Pick<Profile, "id" | "account_type">,
  targetStaffId: string
): Promise<boolean> {
  if (approver.id === targetStaffId) return false;
  if (approver.account_type === "admin") return true;

  const supabase = getSupabaseAdmin();
  const { data: target } = await supabase.from("profiles").select("reports_to").eq("id", targetStaffId).single();
  return target?.reports_to === approver.id;
}
