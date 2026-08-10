"use client";

import { useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

type Document = {
  id: string;
  document_type: string;
  file_name: string;
  uploaded_at: string;
  staff?: { full_name: string | null } | null;
  uploader?: { full_name: string | null } | null;
};
type StaffOption = { id: string; name: string };

const DOCUMENT_TYPES = ["Aadhaar", "PAN", "Resume", "Offer Letter", "Appointment Letter", "Passport", "Driving License", "Educational Certificate"];

export default function DocumentsPage() {
  const [ownId, setOwnId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [viewingStaffId, setViewingStaffId] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
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

        // Team Members already returns just yourself for a rater, or
        // yourself + your reporting chain for a leader/group_leader, or
        // everyone for admin — the same hierarchy this page's own access
        // is scoped to, so a manager gets the switcher automatically and
        // a rater with no reports just sees their own documents.
        const res = await fetch("/api/team-members");
        const data = await res.json();
        const members = (data.members ?? []) as { id: string; full_name: string | null; organizationName?: string | null }[];
        const orgCount = new Set(members.map((p) => p.organizationName)).size;
        const opts = members.map((p) => ({
          id: p.id,
          name: orgCount > 1 && p.organizationName ? `${p.full_name ?? "Unnamed"} — ${p.organizationName}` : (p.full_name ?? "Unnamed"),
        }));
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
    if (isAdmin && viewingStaffId && viewingStaffId !== ownId) form.append("staffId", viewingStaffId);
    const res = await fetch("/api/employee-documents", { method: "POST", body: form });
    setUploading(false);
    if (res.ok) {
      setFile(null);
      await load(viewingStaffId === ownId ? undefined : viewingStaffId);
      showSuccess("Document uploaded.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to upload document.");
    }
  }

  if (loading) {
    return <LoadingBlock />;
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  const columns: DataTableColumn<Document>[] = [
    { key: "type", header: "Type", className: "w-[12%] whitespace-nowrap", render: (d) => <span className="font-medium" style={{ color: "var(--color-ink)" }}>{d.document_type}</span>, exportValue: (d) => d.document_type, sortValue: (d) => d.document_type },
    { key: "file", header: "File", render: (d) => d.file_name, exportValue: (d) => d.file_name, sortValue: (d) => d.file_name },
    { key: "uploadedFor", header: "Uploaded For", render: (d) => d.staff?.full_name ?? "—", exportValue: (d) => d.staff?.full_name ?? "", sortValue: (d) => d.staff?.full_name },
    { key: "uploadedBy", header: "Uploaded By", render: (d) => d.uploader?.full_name ?? "—", exportValue: (d) => d.uploader?.full_name ?? "", sortValue: (d) => d.uploader?.full_name },
    { key: "uploaded", header: "Uploaded", className: "w-[12%] whitespace-nowrap", render: (d) => new Date(d.uploaded_at).toLocaleDateString("en-IN"), exportValue: (d) => new Date(d.uploaded_at).toLocaleDateString("en-IN"), sortValue: (d) => d.uploaded_at },
    {
      key: "actions",
      header: "",
      render: (d) => (
        <a href={`/api/employee-documents/${d.id}/download`} className="text-xs font-semibold underline" style={{ color: "var(--color-action-dark)" }}>
          Download
        </a>
      ),
    },
  ];
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
              ? "Your documents, plus your team's — visible to you as their manager, and to admin."
              : "Upload and manage your own documents — visible to you and admin."
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
            {isAdmin ? null : <option value={ownId}>Myself</option>}
            {staffOptions.filter((s) => isAdmin || s.id !== ownId).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
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
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>File</label>
          <input
            required
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-[var(--color-line)] file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-ink)] file:transition-colors hover:file:bg-[var(--color-accent-tint)]"
          />
        </div>
        <button type="submit" disabled={uploading || !file} className="rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>
      )}

      <DataTable
        columns={columns}
        fixedLayout
        rows={documents}
        getRowKey={(d) => d.id}
        itemLabel="documents"
        emptyMessage="No documents uploaded yet."
        dateFilter={{ getDate: (d) => d.uploaded_at }}
        exportFilename="documents"
      />
    </div>
  );
}
