import type { getSupabaseAdmin } from "@/lib/supabase-admin";

// Every place that sends a transactional email and catches a failure
// calls this instead of just console.error'ing it — see
// supabase/migrations/20260817000000_email_failure_log.sql for why. A
// logging failure here is deliberately swallowed (not re-thrown) — this
// is best-effort visibility, not something that should ever make the
// caller's actual operation (the order, the payment, the account) fail
// because the *logging* of an email failure itself failed.
export async function logEmailFailure(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: { emailType: string; recipientEmail: string; relatedEntity?: string; errorMessage: string; organizationId?: string }
) {
  try {
    await supabase.from("email_failures").insert({
      organization_id: input.organizationId ?? null,
      email_type: input.emailType,
      recipient_email: input.recipientEmail,
      related_entity: input.relatedEntity ?? null,
      error_message: input.errorMessage,
    });
  } catch (err) {
    console.error("Failed to log email failure (email itself also failed):", err);
  }
}
