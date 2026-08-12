import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { Logo } from "@/components/Logo";
import { CONTACT_LINKS, SITE_NAME } from "@/config/site";
import { PayNowButton } from "@/components/PayNowButton";

// Public payment-request page — the invoice's own UUID acts as the access
// token (unguessable, same pattern many small invoicing tools use for a
// "view my invoice" link), so a customer can open this straight from the
// email without needing to sign in. Razorpay Checkout handles the actual
// payment (see PayNowButton); calling/WhatsApp stays as a fallback for
// anyone who'd rather pay another way.
export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, profiles!invoices_customer_id_fkey(full_name, company), invoice_line_items(*), invoice_payments(amount)")
    .eq("id", id)
    .single();

  let customerEmail = "";
  let issuerName = SITE_NAME;
  let issuerLogoUrl: string | null = null;
  let isLegalEfilings = true;
  if (invoice) {
    const { data: authUser } = await supabase.auth.admin.getUserById(invoice.customer_id);
    customerEmail = authUser?.user?.email ?? "";

    // A tenant org's own invoice should show up branded as theirs, not
    // Legal Efilings — this page is the customer-facing payment link for
    // whichever org actually issued the invoice.
    const [{ data: org }, { data: settings }] = await Promise.all([
      supabase.from("organizations").select("name, slug").eq("id", invoice.organization_id).single(),
      supabase.from("company_settings").select("logo_url").eq("organization_id", invoice.organization_id).maybeSingle(),
    ]);
    if (org) {
      issuerName = org.name;
      isLegalEfilings = org.slug === "legal-efilings";
    }
    issuerLogoUrl = settings?.logo_url ?? null;
  }

  if (!invoice) notFound();

  const isPaid = invoice.status === "paid";
  const isPartiallyPaid = invoice.status === "partially_paid";
  const totalPaid = (invoice.invoice_payments as { amount: number }[] | null ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceDue = Math.max(0, Number(invoice.total) - totalPaid);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-16">
      {isLegalEfilings ? (
        <Logo />
      ) : issuerLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={issuerLogoUrl} alt={issuerName} className="h-10 w-auto" />
      ) : (
        <p className="text-xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>{issuerName}</p>
      )}

      <div className="mt-8 w-full rounded-2xl border bg-white p-8" style={{ borderColor: "var(--color-line)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
              {invoice.invoice_number}
            </p>
            <p className="text-lg font-bold" style={{ color: "var(--color-ink)" }}>
              {invoice.profiles?.full_name ?? "Customer"}
            </p>
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={
              isPaid
                ? { backgroundColor: "var(--color-success-tint)", color: "var(--color-success)" }
                : isPartiallyPaid
                  ? { backgroundColor: "var(--color-action-tint)", color: "var(--color-action-dark)" }
                  : { backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }
            }
          >
            {isPaid ? "Paid" : isPartiallyPaid ? "Partially Paid" : "Awaiting Payment"}
          </span>
        </div>

        <div className="mt-6 space-y-2 rounded-xl p-4" style={{ backgroundColor: "var(--color-paper)" }}>
          {(invoice.invoice_line_items ?? []).map((item: { id: string; description: string; amount: number }) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--color-ink-soft)" }}>{item.description}</span>
              <span className="font-medium" style={{ color: "var(--color-ink)" }}>₹{Number(item.amount).toLocaleString("en-IN")}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-2 text-sm" style={{ borderColor: "var(--color-line)" }}>
            <span style={{ color: "var(--color-ink-soft)" }}>Tax</span>
            <span style={{ color: "var(--color-ink)" }}>₹{Number(invoice.tax_amount).toLocaleString("en-IN")}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-sm" style={{ borderColor: "var(--color-line)" }}>
            <span style={{ color: "var(--color-ink-soft)" }}>Invoice Total</span>
            <span style={{ color: "var(--color-ink)" }}>₹{Number(invoice.total).toLocaleString("en-IN")}</span>
          </div>
          {isPartiallyPaid && (
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--color-ink-soft)" }}>Already Paid</span>
              <span style={{ color: "var(--color-success)" }}>− ₹{totalPaid.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--color-line)" }}>
            <span className="font-semibold" style={{ color: "var(--color-ink)" }}>{isPaid ? "Total Paid" : "Balance Due"}</span>
            <span className="text-lg font-extrabold" style={{ color: "var(--color-ink)" }}>₹{(isPaid ? totalPaid : balanceDue).toLocaleString("en-IN")}</span>
          </div>
        </div>

        {isPaid ? (
          <p className="mt-6 rounded-lg px-4 py-3 text-center text-sm" style={{ backgroundColor: "var(--color-success-tint)", color: "var(--color-success)" }}>
            This invoice has been marked as paid — thank you!
          </p>
        ) : (
          <>
            <PayNowButton invoiceId={invoice.id} customerName={invoice.profiles?.full_name ?? "Customer"} customerEmail={customerEmail} />
            <p className="mt-4 text-center text-xs" style={{ color: "var(--color-ink-soft)" }}>
              Prefer another way? Reach out directly and a team member will confirm the payment method.
            </p>
            <div className="mt-3 flex gap-3">
              <a
                href={CONTACT_LINKS.tel}
                className="flex-1 rounded-full py-2.5 text-center text-sm font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
                style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
              >
                Call to Pay
              </a>
              <a
                href={CONTACT_LINKS.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-full border py-2.5 text-center text-sm font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
                style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
              >
                WhatsApp
              </a>
            </div>
          </>
        )}
      </div>

      <p className="mt-6 text-xs" style={{ color: "var(--color-ink-soft)" }}>
        {isLegalEfilings ? `${SITE_NAME} · Real experts. Real filings. No queues.` : issuerName}
      </p>
    </div>
  );
}
