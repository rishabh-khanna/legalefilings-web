"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#fdc500", "#8a6700", "#1a9d5b", "#b42318", "#5b6b81", "#0f172a"];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
      <h3 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>{title}</h3>
      <div className="mt-4 h-64">{children}</div>
    </div>
  );
}

export function RevenueTrendChart({ data }: { data: { month: string; total: number }[] }) {
  return (
    <ChartCard title="Revenue by Month">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf2" />
          <XAxis dataKey="month" fontSize={11} stroke="#5b6b81" />
          <YAxis fontSize={11} stroke="#5b6b81" />
          <Tooltip formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />
          <Line type="monotone" dataKey="total" stroke="#8a6700" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function LeadsFunnelChart({ data }: { data: { stage: string; count: number }[] }) {
  return (
    <ChartCard title="Leads by Stage">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf2" />
          <XAxis dataKey="stage" fontSize={11} stroke="#5b6b81" />
          <YAxis fontSize={11} stroke="#5b6b81" allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function OrdersStatusChart({ data }: { data: { status: string; count: number }[] }) {
  return (
    <ChartCard title="Orders by Status">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function StaffLeaderboardChart({ data }: { data: { name: string; won: number; assigned: number }[] }) {
  return (
    <ChartCard title="Staff Leaderboard — Leads Won vs Assigned">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf2" />
          <XAxis dataKey="name" fontSize={11} stroke="#5b6b81" />
          <YAxis fontSize={11} stroke="#5b6b81" allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="assigned" fill="#e8ecf2" radius={[6, 6, 0, 0]} name="Assigned" />
          <Bar dataKey="won" fill="#1a9d5b" radius={[6, 6, 0, 0]} name="Won" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
