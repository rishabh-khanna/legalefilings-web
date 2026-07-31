import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { Logo } from "@/components/Logo";
import { CONTACT_LINKS, SITE_NAME } from "@/config/site";

// Public payment-request page — the invoice's own UUID acts as the access
// token (unguessable, same pattern many small invoicing tools use for a
// "view my invoice" link), so a customer can open this straight from the
// email without needing to sign in. No payment gateway is wired up yet
// (see the note on the page itself) — this shows the amount and gives the
// customer a way to actually pay by contacting the team directly.
export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, profiles!invoices_customer_id_fkey(full_name, company), invoice_line_items(*)")
    .eq("id", id)
    .single();

  if (!invoice) notFound();

  const isPaid = invoice.status === "paid";

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-16">
      <Logo />

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
            style={isPaid ? { backgroundColor: "#d0f4db", color: "#116a2c" } : { backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}
          >
            {isPaid ? "Paid" : "Awaiting Payment"}
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
          <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--color-line)" }}>
            <span className="font-semibold" style={{ color: "var(--color-ink)" }}>Total Due</span>
            <span className="text-lg font-extrabold" style={{ color: "var(--color-ink)" }}>₹{Number(invoice.total).toLocaleString("en-IN")}</span>
          </div>
        </div>

        {isPaid ? (
          <p className="mt-6 rounded-lg px-4 py-3 text-center text-sm" style={{ backgroundColor: "#d0f4db", color: "#116a2c" }}>
            This invoice has been marked as paid — thank you!
          </p>
        ) : (
          <>
            <p className="mt-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>
              To complete payment, reach out directly — a real team member will confirm the payment method and mark this invoice paid.
            </p>
            <div className="mt-4 flex gap-3">
              <a
                href={CONTACT_LINKS.tel}
                className="flex-1 rounded-full py-2.5 text-center text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: "var(--color-action)" }}
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
        {SITE_NAME} · Real experts. Real filings. No queues.
      </p>
    </div>
  );
}
