"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Lock, Users as UsersIcon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";

type Visibility = "private" | "manager";
type Document = { id: string; document_type: string; file_name: string; uploaded_at: string; visibility: Visibility };
type StaffOption = { id: string; name: string };

const DOCUMENT_TYPES = ["Aadhaar", "PAN", "Resume", "Offer Letter", "Appointment Letter", "Passport", "Driving License", "Educational Certificate"];

const VISIBILITY_STYLE: Record<Visibility, { bg: string; fg: string; label: string }> = {
  private: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)", label: "Only Me & Admin" },
  manager: { bg: "#fff6d9", fg: "#8a6700", label: "Me, My Manager & Admin" },
};

export default function DocumentsPage() {
  const [ownId, setOwnId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [viewingStaffId, setViewingStaffId] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { message, showSuccess, showError } = useActionMessage();

  async function load(staffId?: string) {
    const url = staffId ? `/api/employee-documents?staffId=${staffId}` : "/api/employee-documents";
    const res = await fetch(url);
    if (res.ok) setDocuments((await res.json()).documents ?? []);
  }

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setOwnId(user.id);
        const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).single();
        const admin = profile?.account_type === "admin";
        setIsAdmin(admin);

        const res = await fetch("/api/team-members");
        const data = await res.json();
        const opts = ((data.members ?? []) as { id: string; full_name: string | null }[]).map((p) => ({ id: p.id, name: p.full_name ?? "Unnamed" }));
        setStaffOptions(opts);

        if (admin && opts[0]) {
          setViewingStaffId(opts[0].id);
          await load(opts[0].id);
        } else {
          setViewingStaffId(user.id);
          await load();
        }
      }
      setLoading(false);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleStaffChange(id: string) {
    setViewingStaffId(id);
    await load(id === ownId ? undefined : id);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("documentType", documentType);
    form.append("visibility", visibility);
    if (isAdmin && viewingStaffId && viewingStaffId !== ownId) form.append("staffId", viewingStaffId);
    const res = await fetch("/api/employee-documents", { method: "POST", body: form });
    setUploading(false);
    if (res.ok) {
      setFile(null);
      setVisibility("private");
      await load(viewingStaffId === ownId ? undefined : viewingStaffId);
      showSuccess("Document uploaded.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to upload document.");
    }
  }

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>Loading…</p>;
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const isOwnView = viewingStaffId === ownId;
  const canSwitchStaff = staffOptions.length > 1 || isAdmin;
  const canUploadHere = isOwnView || isAdmin;

  return (
    <div>
      <DashboardPageHero
        title="Documents"
        subtitle={
          isAdmin
            ? "Upload and view any employee's documents."
            : canSwitchStaff
              ? "Manage your own documents and view what your team has shared with you."
              : "Upload and manage your own documents — private to you and admin unless you choose to share."
        }
      >
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:max-w-xs">
          <HeroKpi icon={FolderOpen} label="Documents on File" value={documents.length} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      {canSwitchStaff && (
        <div className="mt-4 max-w-xs">
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>Viewing</label>
          <select value={viewingStaffId} onChange={(e) => handleStaffChange(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
            <option value={ownId}>Myself</option>
            {staffOptions.filter((s) => s.id !== ownId).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {!isOwnView && !isAdmin && (
            <p className="mt-1 flex items-center gap-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>
              <UsersIcon className="h-3 w-3" /> Showing only documents this person chose to share with their manager.
            </p>
          )}
        </div>
      )}

      {canUploadHere && (
        <form onSubmit={handleUpload} className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>Document Type</label>
            <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {isOwnView && (
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>Who can see it</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                <option value="private">Only Me &amp; Admin</option>
                <option value="manager">Me, My Manager &amp; Admin</option>
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>File</label>
            <input required type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          </div>
          <button type="submit" disabled={uploading || !file} className="rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
      )}

      <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Type</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>File</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Uploaded</th>
              {isOwnView && <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Visibility</th>}
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {documents.map((d) => {
              const vStyle = VISIBILITY_STYLE[d.visibility ?? "private"];
              return (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{d.document_type}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{d.file_name}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{new Date(d.uploaded_at).toLocaleDateString("en-IN")}</td>
                  {isOwnView && (
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: vStyle.bg, color: vStyle.fg }}>
                        {d.visibility === "private" && <Lock className="h-3 w-3" />}
                        {vStyle.label}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <a href={`/api/employee-documents/${d.id}/download`} className="text-xs font-semibold underline" style={{ color: "var(--color-action-dark)" }}>
                      Download
                    </a>
                  </td>
                </tr>
              );
            })}
            {documents.length === 0 && (
              <tr>
                <td colSpan={isOwnView ? 5 : 4} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>No documents uploaded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
