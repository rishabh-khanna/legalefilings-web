import { MOCK_ORDERS, type Order } from "@/lib/dashboard-data";

const STATUS_STYLE: Record<Order["status"], { bg: string; fg: string }> = {
  Completed: { bg: "#d0f4db", fg: "#116a2c" },
  "In Progress": { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  "Awaiting Documents": { bg: "#fde2e2", fg: "#b42318" },
};

export default function OrderHistoryPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
        Order History
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
        Every registration and filing you&apos;ve ordered with us.
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
            {MOCK_ORDERS.map((order) => {
              const style = STATUS_STYLE[order.status];
              return (
                <tr key={order.id} style={{ borderColor: "var(--color-line)" }}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{order.id}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{order.service}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{order.plan}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>{order.amount}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{order.date}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
