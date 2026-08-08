import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ConsultationForm } from "@/components/ConsultationForm";

// A tenant org's own public lead-capture page — /org/[slug] — so a paid
// customer running their own CRM can actually collect leads into it
// instead of every submission everywhere on this site defaulting to
// Legal Efilings' own org. Deliberately minimal (no per-org theming,
// custom copy, or their own domain) — a real, working, sharable link is
// what's needed right now; a fully white-labeled site is a separate,
// later feature.
async function getOrg(slug: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("organizations").select("id, name, slug, status").eq("slug", slug).maybeSingle();
  if (!data || data.status !== "active") return null;
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrg(slug);
  return { title: org ? `Contact ${org.name}` : "Contact" };
}

export default async function OrgLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrg(slug);
  if (!org) notFound();

  return (
    <section style={{ background: "linear-gradient(180deg, var(--color-accent-tint) 0%, var(--color-paper) 65%)" }}>
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="md:float-right md:ml-10 md:w-[27rem]">
          <ConsultationForm variant="dark" orgSlug={org.slug} />
        </div>
        <div className="md:mr-[29.5rem]">
          <h1
            className="text-4xl md:text-5xl font-extrabold leading-[1.1] tracking-tight"
            style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}
          >
            Get In Touch With {org.name}
          </h1>
          <p className="mt-3 max-w-md text-base leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
            Share your details and {org.name}&apos;s team will reach out shortly.
          </p>
        </div>
        <div className="clear-both" />
      </div>
    </section>
  );
}
