import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";

type OrderRow = {
  id: string;
  service: string;
  plan: string;
  plan_price: number | null;
  status: "new" | "assigned" | "in_progress" | "under_review" | "completed" | "cancelled";
  created_at: string;
};

const STATUS_LABEL: Record<OrderRow["status"], string> = {
  new: "New",
  assigned: "Assigned",
  in_progress: "In Progress",
  under_review: "Under Review",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_STYLE: Record<OrderRow["status"], { bg: string; fg: string }> = {
  new: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  assigned: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  in_progress: { bg: "#fff6d9", fg: "#8a6700" },
  under_review: { bg: "#fde2e2", fg: "#b42318" },
  completed: { bg: "#d0f4db", fg: "#116a2c" },
  cancelled: { bg: "var(--color-paper)", fg: "var(--color-ink-soft)" },
};

export default async function OrderHistoryPage() {
  const profile = await getCurrentProfile();
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (profile && !isStaffOrAdmin(profile)) {
    query = query.eq("customer_id", profile.id);
  }
  const { data } = await query;
  const orders = (data as OrderRow[] | null) ?? [];

  return (
    <div>
      <h1 className="text-2xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
        {profile && isStaffOrAdmin(profile) ? "Orders" : "Order History"}
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
        {profile && isStaffOrAdmin(profile)
          ? "Every engagement across all customers."
          : "Every registration and filing you've ordered with us."}
      </p>

      <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Order</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Service</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Plan</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Amount</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Date</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {orders.map((order) => {
              const style = STATUS_STYLE[order.status];
              return (
                <tr key={order.id} style={{ borderColor: "var(--color-line)" }}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{order.id.slice(0, 8)}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{order.service}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{order.plan}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>
                    {order.plan_price ? `₹${Number(order.plan_price).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
                    {new Date(order.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
                      {STATUS_LABEL[order.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
