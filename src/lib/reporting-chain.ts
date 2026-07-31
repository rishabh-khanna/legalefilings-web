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

// Can `viewer` act on `targetStaffId`'s attendance/leave/etc.? Admin can
// act on anyone; a leader/group_leader can act on people below them in the
// chain; everyone can act on their own records.
export async function canManageStaff(viewer: Pick<Profile, "id" | "account_type">, targetStaffId: string): Promise<boolean> {
  if (viewer.account_type === "admin") return true;
  if (viewer.id === targetStaffId) return true;
  const chain = await getReportingChainIds(viewer.id);
  return chain.includes(targetStaffId);
}
