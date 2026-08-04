import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";

const BUCKET = "company-assets";

// POST /api/company-settings/upload-asset — admin only. Uploads a logo
// or signature image to the public company-assets bucket and returns its
// public URL, which the caller then saves via PATCH /api/company-settings.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind"); // "logo" | "signature"
  if (!(file instanceof File) || (kind !== "logo" && kind !== "signature")) {
    return NextResponse.json({ error: "file and kind ('logo' or 'signature') are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const path = `${kind}-${Date.now()}.${file.name.split(".").pop() ?? "png"}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: file.type || "image/png",
    upsert: true,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
