import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { logEmailFailure } from "@/lib/email-failures";
import {
  sendDocumentsRequestedEmail,
  sendDocumentsSubmittedEmail,
  sendDocumentReviewedEmail,
} from "@/lib/email";
import { SITE_URL } from "@/config/site";

type Supabase = ReturnType<typeof getSupabaseAdmin>;

// Recipient/branding lookup shared by all three document notifications,
// so a hook can't drift into emailing the wrong person or branding a
// tenant's mail as Legal Efilings.
//
// Every function here is best-effort and never throws: a failed
// notification must not roll back the upload or review that triggered
// it. Failures land in the Email Failures log instead, which is the
// existing place staff already look for exactly this.

async function orderContext(supabase: Supabase, order: Record<string, unknown>) {
  const customerId = order.customer_id as string;
  const organizationId = order.organization_id as string;
  const [{ data: authUser }, { data: customerProfile }, { data: org }] = await Promise.all([
    supabase.auth.admin.getUserById(customerId),
    supabase.from("profiles").select("full_name").eq("id", customerId).single(),
    supabase.from("organizations").select("name").eq("id", organizationId).single(),
  ]);
  return {
    organizationId,
    customerEmail: authUser?.user?.email ?? null,
    customerName: customerProfile?.full_name ?? "there",
    orgName: org?.name ?? undefined,
    service: (order.service as string) ?? "your order",
    // Customers and staff land on different pages: a customer manages
    // documents from their own Order History, staff from the Orders list.
    customerUrl: `${SITE_URL}/dashboard/orders`,
    staffUrl: `${SITE_URL}/dashboard/orders`,
  };
}

async function logFailure(
  supabase: Supabase,
  emailType: string,
  recipient: string,
  orderId: string,
  organizationId: string,
  err: unknown
) {
  console.error(`Failed to send ${emailType} for order ${orderId}:`, err);
  await logEmailFailure(supabase, {
    emailType,
    recipientEmail: recipient,
    relatedEntity: `order:${orderId}`,
    errorMessage: err instanceof Error ? err.message : String(err),
    organizationId,
  });
}

/** Staff flipped the order to "Documents Needed". */
export async function notifyDocumentsRequested(supabase: Supabase, order: Record<string, unknown>) {
  const ctx = await orderContext(supabase, order);
  if (!ctx.customerEmail) return;
  try {
    await sendDocumentsRequestedEmail({
      customerName: ctx.customerName,
      customerEmail: ctx.customerEmail,
      service: ctx.service,
      orderUrl: ctx.customerUrl,
      orgName: ctx.orgName,
    });
  } catch (err) {
    await logFailure(supabase, "documents_requested", ctx.customerEmail, order.id as string, ctx.organizationId, err);
  }
}

/**
 * A customer uploaded a document. Goes to whoever is actually working
 * the order (assigned_to), falling back to the org's admins when nobody
 * is assigned yet — otherwise a self-checkout order, which starts
 * unassigned, would notify nobody at all.
 */
export async function notifyDocumentsSubmitted(
  supabase: Supabase,
  order: Record<string, unknown>,
  fileName: string,
  uploaderId: string
) {
  // Staff uploading on the customer's behalf shouldn't email themselves.
  if (order.customer_id !== uploaderId) return;

  const ctx = await orderContext(supabase, order);
  const assignedTo = order.assigned_to as string | null;

  const { data: recipients } = assignedTo
    ? await supabase.from("profiles").select("id, full_name").eq("id", assignedTo)
    : await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("organization_id", ctx.organizationId)
        .eq("account_type", "admin")
        .eq("is_active", true);

  for (const staff of recipients ?? []) {
    const { data: authUser } = await supabase.auth.admin.getUserById(staff.id);
    const staffEmail = authUser?.user?.email;
    if (!staffEmail) continue;
    try {
      await sendDocumentsSubmittedEmail({
        staffName: staff.full_name ?? "there",
        staffEmail,
        customerName: ctx.customerName,
        service: ctx.service,
        fileName,
        orderUrl: ctx.staffUrl,
        orgName: ctx.orgName,
      });
    } catch (err) {
      await logFailure(supabase, "documents_submitted", staffEmail, order.id as string, ctx.organizationId, err);
    }
  }
}

/** Staff verified or rejected a document. */
export async function notifyDocumentReviewed(
  supabase: Supabase,
  order: Record<string, unknown>,
  fileName: string,
  status: "verified" | "rejected",
  reviewNote: string | null
) {
  const ctx = await orderContext(supabase, order);
  if (!ctx.customerEmail) return;
  try {
    await sendDocumentReviewedEmail({
      customerName: ctx.customerName,
      customerEmail: ctx.customerEmail,
      service: ctx.service,
      fileName,
      status,
      reviewNote,
      orderUrl: ctx.customerUrl,
      orgName: ctx.orgName,
    });
  } catch (err) {
    await logFailure(supabase, "document_reviewed", ctx.customerEmail, order.id as string, ctx.organizationId, err);
  }
}
