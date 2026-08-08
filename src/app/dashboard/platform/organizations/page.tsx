"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { Spinner } from "@/components/Spinner";
import { RequiredMark } from "@/components/RequiredMark";
import { usePagination } from "@/lib/use-pagination";
import { TablePagination } from "@/components/TablePagination";
import { useDateRangeFilter } from "@/lib/use-date-range-filter";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ExportButton } from "@/components/ExportButton";

type Organization = {
  id: string;
  name: string;
  slug: string;
  plan_tier: "internal" | "starter" | "business" | "enterprise";
  status: "active" | "suspended";
  access_expires_at: string | null;
  created_at: string;
  memberCount: number;
};

const PLAN_TIER_LABELS: Record<Organization["plan_tier"], string> = {
  internal: "Internal (Legal Efilings)",
  starter: "Starter",
  business: "Business",
  enterprise: "Enterprise",
};

export default function PlatformOrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [planTier, setPlanTier] = useState<"starter" | "business" | "enterprise">("starter");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; password?: string } | null>(null);

  const load = useCallback(async () => {
    const orgsRes = await fetch("/api/platform/organizations");
    const orgsData = await orgsRes.json();
    if (orgsRes.ok) setOrgs(orgsData.organizations);
  }, []);

  useEffect(() => {
    // Deferred — same pattern used elsewhere in this codebase (DashboardShell,
    // CountdownTimer) to avoid the cascading-render lint rule.
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, [load]);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(
        value
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    const res = await fetch("/api/platform/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, planTier, adminFullName, adminEmail, adminPhone }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (res.ok) {
      setResult({ ok: true, text: `${name} is live — admin account created.`, password: data.tempPassword });
      setName("");
      setSlug("");
      setSlugTouched(false);
      setAdminFullName("");
      setAdminEmail("");
      setAdminPhone("");
      load();
    } else {
      setResult({ ok: false, text: data.error ?? "Failed to create organization." });
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-sm font-medium mb-1";

  const dateFilter = useDateRangeFilter(orgs ?? [], (o) => o.created_at);
  const { page, setPage, pageSize, setPageSize, pageItems: pagedOrgs, totalPages, total, start, end } = usePagination(dateFilter.filtered);

  return (
    <div>
      <DashboardPageHero
        title="Organizations"
        subtitle="Every tenant workspace on the platform — each with its own admin, staff, leads, and invoicing, fully isolated from every other org."
      >
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: "var(--color-action)" }}
        >
          {showForm ? "Cancel" : "+ New Organization"}
        </button>
      </DashboardPageHero>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-2xl border bg-white p-6 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>Organization</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink)" }}>Name<RequiredMark /></label>
              <input required value={name} onChange={(e) => handleNameChange(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} placeholder="Acme Legal Associates" />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink)" }}>Slug<RequiredMark /></label>
              <input required value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} className={inputClass} style={{ borderColor: "var(--color-line)" }} placeholder="acme-legal-associates" />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink)" }}>Plan Tier</label>
              <select value={planTier} onChange={(e) => setPlanTier(e.target.value as typeof planTier)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                <option value="starter">Starter</option>
                <option value="business">Business</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          <p className="pt-2 text-sm font-semibold" style={{ color: "var(--color-ink)" }}>First Admin Account</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink)" }}>Full Name<RequiredMark /></label>
              <input required value={adminFullName} onChange={(e) => setAdminFullName(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink)" }}>Email<RequiredMark /></label>
              <input required type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink)" }}>Phone</label>
              <input value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
          </div>

          {result && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={result.ok ? { backgroundColor: "#d0f4db", color: "#116a2c" } : { backgroundColor: "#fde2e2", color: "#b42318" }}
            >
              <p>{result.text}</p>
              {result.password && (
                <p className="mt-1">
                  Temporary password (share securely, once): <span className="font-mono font-semibold">{result.password}</span>
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            {submitting ? "Creating…" : "Create Organization"}
          </button>
        </form>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--color-line)" }}>
          <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>All Organizations</h2>
          <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Every tenant workspace on the platform, active or suspended.</p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4" style={{ borderColor: "var(--color-line)" }}>
          <DateRangeFilter
            from={dateFilter.from}
            to={dateFilter.to}
            onFromChange={dateFilter.setFrom}
            onToChange={dateFilter.setTo}
            onClear={dateFilter.clear}
            active={dateFilter.active}
          />
          <div>
            <label className="mb-1 block text-xs font-medium invisible" aria-hidden="true">Export</label>
            <ExportButton
              filename="organizations"
              headers={["Organization", "Plan", "Members", "Status", "Access Expires", "Created"]}
              rows={dateFilter.filtered.map((org) => [
                org.name,
                PLAN_TIER_LABELS[org.plan_tier],
                org.memberCount,
                org.status,
                org.access_expires_at ? new Date(org.access_expires_at).toLocaleDateString("en-IN") : "No expiry",
                new Date(org.created_at).toLocaleDateString("en-IN"),
              ])}
            />
          </div>
        </div>

        <div className="border-b px-4 py-2.5" style={{ borderColor: "var(--color-line)" }}>
          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            start={start}
            end={end}
            total={total}
            itemLabel="organizations"
          />
        </div>

        <div className="overflow-x-auto">
        <table className="dt-table w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: "var(--color-line)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>#</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Organization</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Plan</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Members</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Status</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Access Expires</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {orgs === null ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center"><Spinner label="Loading…" /></td></tr>
            ) : orgs.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center" style={{ color: "var(--color-ink-soft)" }}>No organizations yet.</td></tr>
            ) : (
              pagedOrgs.map((org, i) => (
                <tr key={org.id} className="border-b last:border-0" style={{ borderColor: "var(--color-line)" }}>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: "var(--color-ink)" }}>{org.name}</p>
                    {org.plan_tier === "internal" ? (
                      <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>{org.slug}</p>
                    ) : (
                      <a
                        href={`/org/${org.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium"
                        style={{ color: "var(--color-action-dark)" }}
                      >
                        /org/{org.slug} — their public lead page →
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{PLAN_TIER_LABELS[org.plan_tier]}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{org.memberCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={org.status === "active" ? { backgroundColor: "#d0f4db", color: "#116a2c" } : { backgroundColor: "#fde2e2", color: "#b42318" }}
                    >
                      {org.status}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
                    {org.access_expires_at
                      ? new Date(org.access_expires_at) < new Date()
                        ? <span style={{ color: "#b42318" }}>Expired {new Date(org.access_expires_at).toLocaleDateString("en-IN")}</span>
                        : new Date(org.access_expires_at).toLocaleDateString("en-IN")
                      : "No expiry"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{new Date(org.created_at).toLocaleDateString("en-IN")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
