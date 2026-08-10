import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { loadOrderForAccess } from "@/lib/organization";
import { sendOrderCompletedEmail } from "@/lib/email";
import { logEmailFailure } from "@/lib/email-failures";
import { ORDER_STATUS_LABEL, isValidOrderTransition, isTerminalOrderStatus, type OrderStatus } from "@/lib/order-status";

const VALID_STATUSES = ["new", "assigned", "in_progress", "under_review", "completed", "cancelled"];

// PATCH /api/orders/[id]/status — staff/admin only. Before this route
// existed, nothing in the app ever wrote in_progress/under_review/
// completed to an order — the only status write anywhere was the
// payment webhook's one-time new -> assigned, so every order was
// permanently stuck there no matter how the actual work progressed.
// Every change is logged to order_status_history (built in the original
// schema, never wired up until now) so there's a real audit trail of
// who moved an order and when.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const order = await loadOrderForAccess(supabase, profile, id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }
  const note = typeof body?.note === "string" ? body.note.trim() || null : null;

  const oldStatus = order.status as OrderStatus;
  if (status === oldStatus) return NextResponse.json({ ok: true, order });
  if (!isValidOrderTransition(oldStatus, status as OrderStatus)) {
    return NextResponse.json(
      {
        error: isTerminalOrderStatus(oldStatus)
          ? `This order is already ${ORDER_STATUS_LABEL[oldStatus].toLowerCase()} — reopening it isn't possible, create a new order instead.`
          : `Can't move an order from ${ORDER_STATUS_LABEL[oldStatus]} to that status.`,
      },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.from("orders").update({ status }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("order_status_history").insert({
    order_id: id,
    old_status: oldStatus,
    new_status: status,
    changed_by: profile.id,
    note,
  });

  // Every other status-changing action in this app emails the customer
  // (payment confirmation, payment request, bill reminders) — reaching
  // "completed" used to be the one silent exception. A customer whose
  // filing is actually done had no way to know short of checking the
  // dashboard themselves.
  if (status === "completed") {
    const customerId = order.customer_id as string;
    const organizationId = order.organization_id as string;
    const [{ data: authUser }, { data: customerProfile }, { data: org }] = await Promise.all([
      supabase.auth.admin.getUserById(customerId),
      supabase.from("profiles").select("full_name").eq("id", customerId).single(),
      supabase.from("organizations").select("name").eq("id", organizationId).single(),
    ]);
    const customerEmail = authUser?.user?.email;
    try {
      if (customerEmail) {
        await sendOrderCompletedEmail({
          customerName: customerProfile?.full_name ?? "there",
          customerEmail,
          service: order.service as string,
          plan: order.plan as string,
          orgName: org?.name,
        });
      }
    } catch (err) {
      console.error("Failed to send order-completed email:", err);
      await logEmailFailure(supabase, {
        emailType: "order_completed",
        recipientEmail: customerEmail ?? "unknown",
        relatedEntity: `order:${id}`,
        errorMessage: err instanceof Error ? err.message : String(err),
        organizationId,
      });
    }
  }

  return NextResponse.json({ ok: true, order: data });
}
