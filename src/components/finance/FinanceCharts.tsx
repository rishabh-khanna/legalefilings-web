"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { formatMoney } from "@/lib/currency";

const COLORS = ["#fdc500", "#8a6700", "#1a9d5b", "#b42318", "#5b6b81", "#0f172a", "#1d4fb8", "#9d174d"];

function monthLabel(key: string) {
  return new Date(`${key}-01`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
      <h3 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>{title}</h3>
      <div className="mt-4 h-64">{children}</div>
    </div>
  );
}

// Module 13 — the six dashboard charts from the spec, computed from
// /api/expense-manager/charts. Bank Balance Trend is the one worth a
// second look: it's not a stored time series (only current balances
// are), it's reconstructed from opening balances + transaction history,
// same running-balance math the Ledger report already uses.
export function FinanceCharts({
  monthlyExpenses,
  incomeVsExpense,
  cashFlow,
  bankBalanceTrend,
  categoryBreakdown,
  topCategories,
  currency,
}: {
  monthlyExpenses: { month: string; expense: number }[];
  incomeVsExpense: { month: string; income: number; expense: number }[];
  cashFlow: { month: string; net: number }[];
  bankBalanceTrend: { month: string; balance: number }[];
  categoryBreakdown: { category: string; amount: number }[];
  topCategories: { category: string; amount: number }[];
  currency?: string;
}) {
  const monthly = monthlyExpenses.map((d) => ({ ...d, label: monthLabel(d.month) }));
  const incomeExpense = incomeVsExpense.map((d) => ({ ...d, label: monthLabel(d.month) }));
  const flow = cashFlow.map((d) => ({ ...d, label: monthLabel(d.month) }));
  const balanceTrend = bankBalanceTrend.map((d) => ({ ...d, label: monthLabel(d.month) }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Monthly Expenses">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf2" />
            <XAxis dataKey="label" fontSize={11} stroke="#5b6b81" />
            <YAxis fontSize={11} stroke="#5b6b81" />
            <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
            <Bar dataKey="expense" radius={[6, 6, 0, 0]} fill="#b42318" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Expense Category Breakdown">
        {categoryBreakdown.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm" style={{ color: "var(--color-ink-soft)" }}>No expenses in this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categoryBreakdown} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80} label>
                {categoryBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Bank Balance Trend">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={balanceTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf2" />
            <XAxis dataKey="label" fontSize={11} stroke="#5b6b81" />
            <YAxis fontSize={11} stroke="#5b6b81" />
            <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
            <Line type="monotone" dataKey="balance" stroke="#1d4fb8" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Cash Flow (Net)">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={flow}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf2" />
            <XAxis dataKey="label" fontSize={11} stroke="#5b6b81" />
            <YAxis fontSize={11} stroke="#5b6b81" />
            <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
            <Bar dataKey="net" radius={[6, 6, 0, 0]}>
              {flow.map((d, i) => (
                <Cell key={i} fill={d.net >= 0 ? "#1a9d5b" : "#b42318"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Income vs Expense">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={incomeExpense}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf2" />
            <XAxis dataKey="label" fontSize={11} stroke="#5b6b81" />
            <YAxis fontSize={11} stroke="#5b6b81" />
            <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
            <Legend />
            <Bar dataKey="income" name="Income" radius={[6, 6, 0, 0]} fill="#1a9d5b" />
            <Bar dataKey="expense" name="Expense" radius={[6, 6, 0, 0]} fill="#b42318" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Top Expense Categories">
        {topCategories.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm" style={{ color: "var(--color-ink-soft)" }}>No expenses in this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topCategories} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf2" />
              <XAxis type="number" fontSize={11} stroke="#5b6b81" />
              <YAxis type="category" dataKey="category" fontSize={11} stroke="#5b6b81" width={110} />
              <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
              <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                {topCategories.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
