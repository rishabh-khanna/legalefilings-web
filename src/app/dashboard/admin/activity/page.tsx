"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Package, Users, Wallet } from "lucide-react";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { MultiSelect } from "@/components/MultiSelect";

type ActivityRow = {
  id: string;
  at: string;
  source: "invoice" | "order" | "lead" | "finance";
  action: string;
  detail: string;
  actor: string | null;
  href: string | null;
};

const SOURCE_STYLE: Record<ActivityRow["source"], { bg: string; fg: string; label: string }> = {
  invoice: { bg: "var(--color-accent-tint)", fg: "var(--color-action-dark)", label: "Invoice" },
  order: { bg: "var(--color-info-tint)", fg: "var(--color-info)", label: "Order" },
  lead: { bg: "var(--color-success-tint)", fg: "var(--color-success)", label: "Lead" },
  finance: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)", label: "Finance" },
};

// The audit trails were already being written — invoice_events,
// order_status_history, lead_status_history, expense_audit_log — and
// only invoice history had anywhere to read it. This is that missing
// screen: one timeline across all four, so "who changed this and when"
// stops being a question only SQL could answer.
export default function ActivityPage() {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [sourceFilter, setSourceFilter] = useState<Set<string>>(new Set());

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/admin/activity");
      if (res.ok) setRows((await res.json()).activity ?? []);
      else setRows([]);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  const counts = useMemo(() => {
    const all = rows ?? [];
    return {
      invoice: all.filter((r) => r.source === "invoice").length,
      order: all.filter((r) => r.source === "order").length,
      lead: all.filter((r) => r.source === "lead").length,
      finance: all.filter((r) => r.source === "finance").length,
    };
  }, [rows]);

  const filtered = useMemo(
    () => (rows ?? []).filter((r) => sourceFilter.size === 0 || sourceFilter.has(r.source)),
    [rows, sourceFilter]
  );

  if (rows === null) return <LoadingBlock />;

  const columns: DataTableColumn<ActivityRow>[] = [
    {
      key: "when",
      header: "When",
      className: "w-[16%] whitespace-nowrap",
      render: (r) => new Date(r.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      exportValue: (r) => new Date(r.at).toISOString(),
      sortValue: (r) => r.at,
    },
    {
      key: "source",
      header: "Area",
      className: "w-[10%] whitespace-nowrap",
      render: (r) => {
        const s = SOURCE_STYLE[r.source];
        return (
          <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: s.bg, color: s.fg }}>
            {s.label}
          </span>
        );
      },
      exportValue: (r) => SOURCE_STYLE[r.source].label,
      sortValue: (r) => r.source,
    },
    {
      key: "action",
      header: "Action",
      className: "w-[16%] whitespace-nowrap",
      render: (r) => <span className="font-medium capitalize" style={{ color: "var(--color-ink)" }}>{r.action}</span>,
      exportValue: (r) => r.action,
      sortValue: (r) => r.action,
    },
    {
      key: "detail",
      header: "What",
      render: (r) =>
        r.href ? (
          <Link href={r.href} className="underline" style={{ color: "var(--color-action-dark)" }}>{r.detail}</Link>
        ) : (
          r.detail
        ),
      exportValue: (r) => r.detail,
    },
    {
      key: "actor",
      header: "By",
      className: "w-[16%] whitespace-nowrap",
      // Blank rather than "System" when null: some of these trails
      // genuinely predate actor tracking, and labelling those as System
      // would assert something untrue about who did it.
      render: (r) => <span style={{ color: "var(--color-ink-soft)" }}>{r.actor ?? "—"}</span>,
      exportValue: (r) => r.actor ?? "",
      sortValue: (r) => r.actor,
    },
  ];

  return (
    <div>
      <DashboardPageHero
        title="Activity"
        subtitle="Every recorded change across invoices, orders, leads, and Business Finance — who did it and when."
      >
        <div className="relative mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <HeroKpi icon={FileText} label="Invoice events" value={counts.invoice} />
          <HeroKpi icon={Package} label="Order changes" value={counts.order} />
          <HeroKpi icon={Users} label="Lead changes" value={counts.lead} />
          <HeroKpi icon={Wallet} label="Finance events" value={counts.finance} />
        </div>
      </DashboardPageHero>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>
          Nothing recorded yet — activity appears here as invoices, orders, leads, and finance entries change.
        </p>
      ) : (
        <DataTable
          columns={columns}
          fixedLayout
          rows={filtered}
          getRowKey={(r) => r.id}
          itemLabel="events"
          emptyMessage="No activity yet."
          filteredEmptyMessage="No activity in this area."
          search={{
            placeholder: "Search action, item, person…",
            filter: (r, q) => `${r.action} ${r.detail} ${r.actor ?? ""}`.toLowerCase().includes(q),
          }}
          dateFilter={{ getDate: (r) => r.at }}
          exportFilename="activity"
          minWidth={760}
          toolbar={
            <MultiSelect
              options={[
                { value: "invoice", label: "Invoices" },
                { value: "order", label: "Orders" },
                { value: "lead", label: "Leads" },
                { value: "finance", label: "Business Finance" },
              ]}
              selected={sourceFilter}
              onChange={setSourceFilter}
              placeholder="All areas"
            />
          }
        />
      )}
    </div>
  );
}
