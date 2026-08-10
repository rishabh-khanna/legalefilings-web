import nodemailer from "nodemailer";
import { SITE_NAME, CONTACT_LINKS } from "@/config/site";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.BREVO_SMTP_HOST;
  const port = Number(process.env.BREVO_SMTP_PORT ?? 587);
  const user = process.env.BREVO_SMTP_LOGIN;
  const pass = process.env.BREVO_SMTP_KEY;
  if (!host || !user || !pass) {
    throw new Error("Missing Brevo SMTP env vars (BREVO_SMTP_HOST / BREVO_SMTP_LOGIN / BREVO_SMTP_KEY)");
  }
  transporter = nodemailer.createTransport({ host, port, secure: false, auth: { user, pass } });
  return transporter;
}

type LeadAcknowledgementInput = {
  name: string;
  email: string;
  phone: string;
  service?: string;
  plan?: string;
  planPrice?: string;
  // A tenant org's own public lead-capture page (/org/[slug]) passes its
  // name through so this doesn't read as Legal Efilings acknowledging a
  // lead that was actually submitted to someone else's CRM.
  orgName?: string;
};

// A self-contained, table-based HTML email (inline styles only, no external
// CSS/JS) — the layout choices here are deliberate for compatibility with
// Outlook desktop's old rendering engine, which ignores flexbox/grid.
function renderAcknowledgementHtml(lead: LeadAcknowledgementInput) {
  const orgName = lead.orgName ?? SITE_NAME;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://legalefilings-web.vercel.app";
  const logoUrl = `${siteUrl}/images/logo.png`;
  const ink = "#0f172a";
  const inkSoft = "#5b6b81";
  const accent = "#fdc500";
  const accentDark = "#8a6700";
  const paper = "#f6f8fb";

  const summaryRows = [
    lead.service ? { label: "Service", value: lead.service } : null,
    lead.plan ? { label: "Plan", value: lead.plan } : null,
    lead.planPrice ? { label: "Price", value: lead.planPrice } : null,
    { label: "Phone", value: lead.phone },
    { label: "Email", value: lead.email },
  ].filter((r): r is { label: string; value: string } => r !== null);

  const rowsHtml = summaryRows
    .map(
      (r, i) => `
        <tr>
          <td style="padding:12px 20px;border-top:${i === 0 ? "none" : `1px solid #e8ecf2`};font:13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};width:120px;">${r.label}</td>
          <td style="padding:12px 20px;border-top:${i === 0 ? "none" : `1px solid #e8ecf2`};font:600 13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">${r.value}</td>
        </tr>`
    )
    .join("");

  const steps = [
    { title: "We review your request", body: "A real CA/CS expert on our team reads through what you shared — not a bot, not a queue." },
    { title: "We reach out", body: "Expect a call or WhatsApp message from us within one business day to confirm details and next steps." },
    { title: "We get to work", body: "Once confirmed, we handle the filing/registration end-to-end and keep you updated at every stage." },
  ];

  const stepsHtml = steps
    .map(
      (s, i) => `
        <tr>
          <td style="padding:0 0 ${i === steps.length - 1 ? "0" : "18px"} 0;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="width:28px;height:28px;border-radius:50%;background:${accent};text-align:center;vertical-align:middle;font:700 13px/28px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};" align="center">${i + 1}</td>
                <td style="width:12px;"></td>
                <td>
                  <p style="margin:0 0 2px 0;font:600 14px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">${s.title}</p>
                  <p style="margin:0;font:13px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">${s.body}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${paper};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${paper};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.06),0 24px 48px rgba(15,23,42,0.10);">

            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg, ${accent} 0%, #ffe27a 100%);padding:28px 32px;">
                <img src="${logoUrl}" width="150" alt="${orgName}" style="display:block;border:0;" />
              </td>
            </tr>

            <!-- Confirmation banner -->
            <tr>
              <td style="padding:32px 32px 0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width:44px;height:44px;border-radius:50%;background:#e8f7ee;text-align:center;vertical-align:middle;" align="center">
                      <span style="font:20px/44px Arial,sans-serif;color:#1a9d5b;">&#10003;</span>
                    </td>
                    <td style="width:14px;"></td>
                    <td>
                      <p style="margin:0;font:700 20px/1.3 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">Request received, ${lead.name.split(" ")[0]}!</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 0 0;font:14px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">
                  Thanks for reaching out to ${orgName}. We've logged your request and a real compliance expert will be in touch shortly — here's a quick summary of what you shared.
                </p>
              </td>
            </tr>

            <!-- Summary card -->
            <tr>
              <td style="padding:20px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${paper};border-radius:14px;overflow:hidden;">
                  ${rowsHtml}
                </table>
              </td>
            </tr>

            <!-- What happens next -->
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <p style="margin:0 0 16px 0;font:700 15px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">What happens next</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  ${stepsHtml}
                </table>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-radius:10px;background:${ink};">
                      <a href="${CONTACT_LINKS.tel}" style="display:inline-block;padding:12px 22px;font:600 14px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px;">Call us now</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:32px;">
                <hr style="border:none;border-top:1px solid #e8ecf2;margin:0 0 20px 0;" />
                <p style="margin:0 0 4px 0;font:600 13px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">${orgName}</p>
                <p style="margin:0;font:12px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">
                  This is an automated acknowledgment — a member of our team will reach out personally. If this wasn't you, you can safely ignore this email.
                </p>
                <p style="margin:12px 0 0 0;font:11px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${accentDark};">
                  Real experts. Real filings. No queues.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendLeadAcknowledgementEmail(lead: LeadAcknowledgementInput) {
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const orgName = lead.orgName ?? SITE_NAME;
  const fromName = process.env.EMAIL_FROM_NAME ?? orgName;
  if (!fromAddress) throw new Error("Missing EMAIL_FROM_ADDRESS env var");

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: lead.email,
    subject: `We've received your request — ${orgName}`,
    html: renderAcknowledgementHtml(lead),
  });
}

type PaymentRequestInput = {
  customerName: string;
  customerEmail: string;
  service: string;
  plan: string;
  amount: number;
  paymentUrl: string;
  // The staff member's own org — a tenant's admin/staff buying a plan
  // for their own customer (see /api/orders/buy-for-customer) shouldn't
  // send an email that reads as coming from Legal Efilings.
  orgName?: string;
};

function renderPaymentRequestHtml(input: PaymentRequestInput) {
  const orgName = input.orgName ?? SITE_NAME;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://legalefilings-web.vercel.app";
  const logoUrl = `${siteUrl}/images/logo.png`;
  const ink = "#0f172a";
  const inkSoft = "#5b6b81";
  const accent = "#fdc500";
  const paper = "#f6f8fb";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${paper};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${paper};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.06),0 24px 48px rgba(15,23,42,0.10);">
            <tr>
              <td style="background:linear-gradient(135deg, ${accent} 0%, #ffe27a 100%);padding:28px 32px;">
                <img src="${logoUrl}" width="150" alt="${orgName}" style="display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0;font:700 20px/1.3 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">Hi ${input.customerName.split(" ")[0]}, your payment request is ready</p>
                <p style="margin:14px 0 0 0;font:14px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">
                  Here's a summary of the plan we discussed — click below to view the full details and complete payment.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background:${paper};border-radius:14px;overflow:hidden;">
                  <tr>
                    <td style="padding:14px 18px;font:13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">Service</td>
                    <td style="padding:14px 18px;font:600 13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};text-align:right;">${input.service}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 14px 18px;font:13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">Plan</td>
                    <td style="padding:0 18px 14px 18px;font:600 13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};text-align:right;">${input.plan}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 14px 18px;border-top:1px solid #e8ecf2;font:700 14px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};padding-top:14px;">Amount Due</td>
                    <td style="padding:0 18px 14px 18px;border-top:1px solid #e8ecf2;font:700 16px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};text-align:right;padding-top:14px;">₹${input.amount.toLocaleString("en-IN")}</td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                  <tr>
                    <td style="border-radius:10px;background:${ink};">
                      <a href="${input.paymentUrl}" style="display:inline-block;padding:14px 28px;font:600 15px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px;">View &amp; Pay</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <hr style="border:none;border-top:1px solid #e8ecf2;margin:0 0 20px 0;" />
                <p style="margin:0;font:600 13px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">${orgName}</p>
                <p style="margin:4px 0 0 0;font:12px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">Real experts. Real filings. No queues.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendPaymentRequestEmail(input: PaymentRequestInput) {
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const orgName = input.orgName ?? SITE_NAME;
  const fromName = process.env.EMAIL_FROM_NAME ?? orgName;
  if (!fromAddress) throw new Error("Missing EMAIL_FROM_ADDRESS env var");

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: input.customerEmail,
    subject: `Payment request for ${input.service} — ${orgName}`,
    html: renderPaymentRequestHtml(input),
  });
}

type PaymentConfirmationInput = {
  customerName: string;
  customerEmail: string;
  invoiceNumber: string;
  service: string;
  plan: string;
  amount: number;
  paymentId: string;
  // The invoice's own issuing org — a tenant org's customer paying their
  // invoice shouldn't get a receipt branded as Legal Efilings.
  orgName?: string;
};

function renderPaymentConfirmationHtml(input: PaymentConfirmationInput) {
  const orgName = input.orgName ?? SITE_NAME;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://legalefilings-web.vercel.app";
  const logoUrl = `${siteUrl}/images/logo.png`;
  const ink = "#0f172a";
  const inkSoft = "#5b6b81";
  const green = "#116a2c";
  const greenTint = "#d0f4db";
  const paper = "#f6f8fb";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${paper};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${paper};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.06),0 24px 48px rgba(15,23,42,0.10);">
            <tr>
              <td style="background:${greenTint};padding:28px 32px;">
                <img src="${logoUrl}" width="150" alt="${orgName}" style="display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0;font:700 20px/1.3 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${green};">Payment received — thank you, ${input.customerName.split(" ")[0]}!</p>
                <p style="margin:14px 0 0 0;font:14px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">
                  We've received your payment for ${input.service} and our team will begin work shortly.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background:${paper};border-radius:14px;overflow:hidden;">
                  <tr>
                    <td style="padding:14px 18px;font:13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">Invoice</td>
                    <td style="padding:14px 18px;font:600 13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};text-align:right;">${input.invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 14px 18px;font:13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">Plan</td>
                    <td style="padding:0 18px 14px 18px;font:600 13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};text-align:right;">${input.plan}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 14px 18px;font:13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">Payment ID</td>
                    <td style="padding:0 18px 14px 18px;font:600 13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};text-align:right;">${input.paymentId}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 14px 18px;border-top:1px solid #e8ecf2;font:700 14px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};padding-top:14px;">Amount Paid</td>
                    <td style="padding:0 18px 14px 18px;border-top:1px solid #e8ecf2;font:700 16px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${green};text-align:right;padding-top:14px;">₹${input.amount.toLocaleString("en-IN")}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <hr style="border:none;border-top:1px solid #e8ecf2;margin:0 0 20px 0;" />
                <p style="margin:0;font:600 13px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">${orgName}</p>
                <p style="margin:4px 0 0 0;font:12px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">Real experts. Real filings. No queues.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendPaymentConfirmationEmail(input: PaymentConfirmationInput) {
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const orgName = input.orgName ?? SITE_NAME;
  const fromName = process.env.EMAIL_FROM_NAME ?? orgName;
  if (!fromAddress) throw new Error("Missing EMAIL_FROM_ADDRESS env var");

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: input.customerEmail,
    subject: `Payment received — ${input.invoiceNumber} — ${orgName}`,
    html: renderPaymentConfirmationHtml(input),
  });
}

type OrderCompletedInput = {
  customerName: string;
  customerEmail: string;
  service: string;
  plan: string;
  // The org that actually did the filing — same reasoning as every
  // other customer-facing email here: a tenant org's own customer
  // shouldn't get a completion notice branded as Legal Efilings.
  orgName?: string;
};

function renderOrderCompletedHtml(input: OrderCompletedInput) {
  const orgName = input.orgName ?? SITE_NAME;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://legalefilings-web.vercel.app";
  const logoUrl = `${siteUrl}/images/logo.png`;
  const ink = "#0f172a";
  const inkSoft = "#5b6b81";
  const green = "#116a2c";
  const greenTint = "#d0f4db";
  const paper = "#f6f8fb";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${paper};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${paper};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.06),0 24px 48px rgba(15,23,42,0.10);">
            <tr>
              <td style="background:${greenTint};padding:28px 32px;">
                <img src="${logoUrl}" width="150" alt="${orgName}" style="display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0;font:700 20px/1.3 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${green};">Your ${input.service} is complete, ${input.customerName.split(" ")[0]}!</p>
                <p style="margin:14px 0 0 0;font:14px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">
                  Great news — our team has finished work on your ${input.plan} plan. Sign in to your dashboard to view your order and any documents we've delivered.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <hr style="border:none;border-top:1px solid #e8ecf2;margin:0 0 20px 0;" />
                <p style="margin:0;font:600 13px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">${orgName}</p>
                <p style="margin:4px 0 0 0;font:12px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">Real experts. Real filings. No queues.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendOrderCompletedEmail(input: OrderCompletedInput) {
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const orgName = input.orgName ?? SITE_NAME;
  const fromName = process.env.EMAIL_FROM_NAME ?? orgName;
  if (!fromAddress) throw new Error("Missing EMAIL_FROM_ADDRESS env var");

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: input.customerEmail,
    subject: `Your ${input.service} is complete — ${orgName}`,
    html: renderOrderCompletedHtml(input),
  });
}

type AccountCreatedInput = {
  customerName: string;
  customerEmail: string;
  tempPassword: string;
};

function renderAccountCreatedHtml(input: AccountCreatedInput) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://legalefilings-web.vercel.app";
  const logoUrl = `${siteUrl}/images/logo.png`;
  const ink = "#0f172a";
  const inkSoft = "#5b6b81";
  const accent = "#fdc500";
  const paper = "#f6f8fb";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${paper};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${paper};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.06),0 24px 48px rgba(15,23,42,0.10);">
            <tr>
              <td style="background:linear-gradient(135deg, ${accent} 0%, #ffe27a 100%);padding:28px 32px;">
                <img src="${logoUrl}" width="150" alt="${SITE_NAME}" style="display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0;font:700 20px/1.3 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">Welcome, ${input.customerName.split(" ")[0]} — your account is ready</p>
                <p style="margin:14px 0 0 0;font:14px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">
                  We created an account for you so you can track your order and download invoices anytime.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background:${paper};border-radius:14px;overflow:hidden;">
                  <tr>
                    <td style="padding:14px 18px;font:13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">Email</td>
                    <td style="padding:14px 18px;font:600 13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};text-align:right;">${input.customerEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 14px 18px;font:13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">Temporary Password</td>
                    <td style="padding:0 18px 14px 18px;font:700 13px/1.4 monospace;color:${ink};text-align:right;">${input.tempPassword}</td>
                  </tr>
                </table>
                <p style="margin:16px 0 0 0;font:13px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">
                  Please sign in and change this password from your profile as soon as you can.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                  <tr>
                    <td style="border-radius:10px;background:${ink};">
                      <a href="${siteUrl}/login" style="display:inline-block;padding:14px 28px;font:600 15px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px;">Sign In</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <hr style="border:none;border-top:1px solid #e8ecf2;margin:0 0 20px 0;" />
                <p style="margin:0;font:600 13px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">${SITE_NAME}</p>
                <p style="margin:4px 0 0 0;font:12px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">Real experts. Real filings. No queues.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendAccountCreatedEmail(input: AccountCreatedInput) {
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME ?? SITE_NAME;
  if (!fromAddress) throw new Error("Missing EMAIL_FROM_ADDRESS env var");

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: input.customerEmail,
    subject: `Your ${SITE_NAME} account is ready`,
    html: renderAccountCreatedHtml(input),
  });
}

// orgName: the recipient's own tenant org (falls back to SITE_NAME for
// Legal Efilings' own staff, and for any org that hasn't set a distinct
// brand name) — the birthday cron runs across every org's staff at once
// (see /api/cron/birthdays), so this can't just hardcode Legal Efilings'
// branding the way the rest of this file's Legal-Efilings-only emails do.
function renderBirthdayHtml(firstName: string, orgName: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://legalefilings-web.vercel.app";
  const logoUrl = `${siteUrl}/images/logo.png`;
  const ink = "#0f172a";
  const inkSoft = "#5b6b81";
  const accent = "#fdc500";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f8fb;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f8fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.06),0 24px 48px rgba(15,23,42,0.10);">
            <tr>
              <td style="background:linear-gradient(135deg, ${accent} 0%, #ffe27a 100%);padding:28px 32px;">
                <img src="${logoUrl}" width="150" alt="${orgName}" style="display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px;text-align:center;">
                <p style="margin:0;font-size:44px;line-height:1;">🎉🎂🎈</p>
                <p style="margin:20px 0 0 0;font:700 24px/1.3 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">Happy Birthday, ${firstName}!</p>
                <p style="margin:14px 0 0 0;font:14px/1.7 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">
                  Wishing you a fantastic day filled with good things. Thank you for being part of the ${orgName} family — here's to another great year ahead!
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <hr style="border:none;border-top:1px solid #e8ecf2;margin:0 0 20px 0;" />
                <p style="margin:0;font:600 13px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">${orgName}</p>
                <p style="margin:4px 0 0 0;font:12px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">Real experts. Real filings. No queues.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Bill Reminder (Smart Automation #5) — plain and short by design, this
// is a "don't forget" nudge for a recurring expense a few days out, not
// a branded marketing email; it's the same content regardless of which
// org's customer it's going to, so it doesn't need the orgName
// parametrization the other emails in this file got in the multi-tenant
// pass — a business's own recurring bill reminder is inherently personal
// to them either way.
export async function sendBillReminderEmail(input: { email: string; description: string; amount: number; dueDate: string }) {
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME ?? SITE_NAME;
  if (!fromAddress) throw new Error("Missing EMAIL_FROM_ADDRESS env var");

  const dueDateLabel = new Date(input.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: input.email,
    subject: `Upcoming bill: ${input.description} due ${dueDateLabel}`,
    html: `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f8fb;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f8fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:28px;box-shadow:0 1px 2px rgba(15,23,42,0.06),0 24px 48px rgba(15,23,42,0.10);">
            <tr>
              <td>
                <p style="margin:0;font:700 18px/1.3;color:#0f172a;">Upcoming bill reminder</p>
                <p style="margin:14px 0 0 0;font:14px/1.6;color:#5b6b81;">
                  <strong>${input.description}</strong> — ₹${input.amount.toLocaleString("en-IN")} is due on <strong>${dueDateLabel}</strong>.
                </p>
                <p style="margin:14px 0 0 0;font:13px/1.6;color:#5b6b81;">This will be recorded automatically in your Business Finance books on the due date.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  });
}

export async function sendBirthdayEmail(person: { name: string; email: string; orgName?: string }) {
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const orgName = person.orgName ?? SITE_NAME;
  const fromName = process.env.EMAIL_FROM_NAME ?? orgName;
  if (!fromAddress) throw new Error("Missing EMAIL_FROM_ADDRESS env var");

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: person.email,
    subject: `🎂 Happy Birthday from ${orgName}!`,
    html: renderBirthdayHtml(person.name.split(" ")[0], orgName),
  });
}

type InvoiceEmailInput = {
  customerName: string;
  customerEmail: string;
  invoiceNumber: string;
  amount: number;
  pdfBuffer: Buffer;
  // The invoice's own issuing org — a tenant org's invoice shouldn't
  // arrive branded as Legal Efilings.
  orgName?: string;
};

function renderInvoiceEmailHtml(input: InvoiceEmailInput) {
  const orgName = input.orgName ?? SITE_NAME;
  const ink = "#0f172a";
  const inkSoft = "#5b6b81";
  const paper = "#f6f8fb";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${paper};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${paper};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:20px;padding:32px;box-shadow:0 1px 2px rgba(15,23,42,0.06),0 24px 48px rgba(15,23,42,0.10);">
            <tr>
              <td>
                <p style="margin:0;font:700 20px/1.3 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">Invoice ${input.invoiceNumber}</p>
                <p style="margin:14px 0 0 0;font:14px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">
                  Hi ${input.customerName.split(" ")[0]}, please find your invoice for ₹${input.amount.toLocaleString("en-IN")} attached to this email.
                </p>
                <p style="margin:16px 0 0 0;font:13px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">${orgName}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendInvoiceEmail(input: InvoiceEmailInput) {
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const orgName = input.orgName ?? SITE_NAME;
  const fromName = process.env.EMAIL_FROM_NAME ?? orgName;
  if (!fromAddress) throw new Error("Missing EMAIL_FROM_ADDRESS env var");

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: input.customerEmail,
    subject: `Invoice ${input.invoiceNumber} — ${orgName}`,
    html: renderInvoiceEmailHtml(input),
    attachments: [{ filename: `${input.invoiceNumber}.pdf`, content: input.pdfBuffer }],
  });
}

type InvoiceReminderInput = {
  customerName: string;
  customerEmail: string;
  invoiceNumber: string;
  amountDue: number;
  dueDate: string;
  payUrl: string;
  // Negative = still due in future (courtesy nudge), 0 = due today,
  // positive = this many days late.
  daysOverdue: number;
  // The invoice's own issuing org — a tenant's customer shouldn't be
  // chased by an email branded as Legal Efilings.
  orgName?: string;
};

function renderInvoiceReminderHtml(input: InvoiceReminderInput) {
  const orgName = input.orgName ?? SITE_NAME;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://legalefilings-web.vercel.app";
  const logoUrl = `${siteUrl}/images/logo.png`;
  const ink = "#0f172a";
  const inkSoft = "#5b6b81";
  const paper = "#f6f8fb";
  const late = input.daysOverdue > 0;
  // Tone escalates with age, but never becomes threatening — the most
  // common reason an invoice is unpaid is that it was genuinely missed.
  const accent = late ? (input.daysOverdue >= 14 ? "#b42318" : "#e8a13a") : "#fdc500";
  const headline = late
    ? `Payment overdue — ${input.daysOverdue} day${input.daysOverdue === 1 ? "" : "s"}`
    : input.daysOverdue === 0
      ? "Payment due today"
      : `Payment due in ${Math.abs(input.daysOverdue)} day${Math.abs(input.daysOverdue) === 1 ? "" : "s"}`;
  const dueLabel = new Date(input.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${paper};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${paper};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.06),0 24px 48px rgba(15,23,42,0.10);">
            <tr>
              <td style="background:${accent};padding:24px 32px;">
                <img src="${logoUrl}" width="150" alt="${orgName}" style="display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0;font:700 20px/1.3 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">${headline}</p>
                <p style="margin:14px 0 0 0;font:14px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">
                  Hi ${input.customerName.split(" ")[0]}, this is a reminder about invoice <strong>${input.invoiceNumber}</strong>${late ? ", which is now past its due date" : ""}. If you've already paid, please ignore this — payments can take a day or two to show up.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background:${paper};border-radius:14px;overflow:hidden;">
                  <tr>
                    <td style="padding:14px 18px;font:13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">Invoice</td>
                    <td style="padding:14px 18px;font:600 13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};text-align:right;">${input.invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 14px 18px;font:13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">Due date</td>
                    <td style="padding:0 18px 14px 18px;font:600 13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};text-align:right;">${dueLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 14px 18px;border-top:1px solid #e8ecf2;font:700 14px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};padding-top:14px;">Amount Due</td>
                    <td style="padding:0 18px 14px 18px;border-top:1px solid #e8ecf2;font:700 16px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};text-align:right;padding-top:14px;">₹${input.amountDue.toLocaleString("en-IN")}</td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                  <tr>
                    <td style="border-radius:10px;background:${ink};">
                      <a href="${input.payUrl}" style="display:inline-block;padding:14px 28px;font:600 15px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px;">Pay Now</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <hr style="border:none;border-top:1px solid #e8ecf2;margin:0 0 20px 0;" />
                <p style="margin:0;font:600 13px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">${orgName}</p>
                <p style="margin:4px 0 0 0;font:12px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">Questions about this invoice? Just reply to this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendInvoiceReminderEmail(input: InvoiceReminderInput) {
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const orgName = input.orgName ?? SITE_NAME;
  const fromName = process.env.EMAIL_FROM_NAME ?? orgName;
  if (!fromAddress) throw new Error("Missing EMAIL_FROM_ADDRESS env var");

  const subject =
    input.daysOverdue > 0
      ? `Overdue: invoice ${input.invoiceNumber} — ₹${input.amountDue.toLocaleString("en-IN")}`
      : `Reminder: invoice ${input.invoiceNumber} is due ${input.daysOverdue === 0 ? "today" : "soon"}`;

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: input.customerEmail,
    subject,
    html: renderInvoiceReminderHtml(input),
  });
}

// ── Order document exchange ───────────────────────────────────────────
// The back-and-forth of collecting KYC/filing paperwork was the one core
// loop in this app that emailed nobody, in either direction: a customer
// was never told documents were needed, staff were never told something
// had arrived to review, and a rejected document's reason only existed
// on a screen the customer had no reason to revisit. Orders stalled
// indefinitely with each side assuming the other had it.

const DOC_SHELL_INK = "#0f172a";
const DOC_SHELL_SOFT = "#5b6b81";
const DOC_SHELL_PAPER = "#f6f8fb";

function renderDocumentShell(opts: {
  orgName: string;
  bannerColor: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  extra?: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://legalefilings-web.vercel.app";
  const logoUrl = `${siteUrl}/images/logo.png`;
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${DOC_SHELL_PAPER};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${DOC_SHELL_PAPER};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.06),0 24px 48px rgba(15,23,42,0.10);">
            <tr>
              <td style="background:${opts.bannerColor};padding:24px 32px;">
                <img src="${logoUrl}" width="150" alt="${opts.orgName}" style="display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0;font:700 20px/1.3 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${DOC_SHELL_INK};">${opts.heading}</p>
                <p style="margin:14px 0 0 0;font:14px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${DOC_SHELL_SOFT};">${opts.body}</p>
                ${opts.extra ?? ""}
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                  <tr>
                    <td style="border-radius:10px;background:${DOC_SHELL_INK};">
                      <a href="${opts.ctaUrl}" style="display:inline-block;padding:14px 28px;font:600 15px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px;">${opts.ctaLabel}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <hr style="border:none;border-top:1px solid #e8ecf2;margin:0 0 20px 0;" />
                <p style="margin:0;font:600 13px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${DOC_SHELL_INK};">${opts.orgName}</p>
                <p style="margin:4px 0 0 0;font:12px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${DOC_SHELL_SOFT};">Questions? Just reply to this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendDocumentMail(to: string, subject: string, html: string, orgName: string) {
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME ?? orgName;
  if (!fromAddress) throw new Error("Missing EMAIL_FROM_ADDRESS env var");
  await getTransporter().sendMail({ from: `"${fromName}" <${fromAddress}>`, to, subject, html });
}

/** Staff asked the customer for paperwork — tell them what's needed and where to put it. */
export async function sendDocumentsRequestedEmail(input: {
  customerName: string;
  customerEmail: string;
  service: string;
  orderUrl: string;
  orgName?: string;
}) {
  const orgName = input.orgName ?? SITE_NAME;
  await sendDocumentMail(
    input.customerEmail,
    `Documents needed for your ${input.service}`,
    renderDocumentShell({
      orgName,
      bannerColor: "#fdc500",
      heading: "We need a few documents from you",
      body: `Hi ${input.customerName.split(" ")[0]}, to move your <strong>${input.service}</strong> forward we need some paperwork from you. Upload it from your order page — it takes a minute, and we'll review it as soon as it lands.`,
      ctaLabel: "Upload documents",
      ctaUrl: input.orderUrl,
    }),
    orgName
  );
}

/** A customer uploaded something — tell the staff handling the order it's waiting on them. */
export async function sendDocumentsSubmittedEmail(input: {
  staffName: string;
  staffEmail: string;
  customerName: string;
  service: string;
  fileName: string;
  orderUrl: string;
  orgName?: string;
}) {
  const orgName = input.orgName ?? SITE_NAME;
  await sendDocumentMail(
    input.staffEmail,
    `${input.customerName} uploaded a document for ${input.service}`,
    renderDocumentShell({
      orgName,
      bannerColor: "#dbe7ff",
      heading: "A document is waiting for review",
      body: `${input.customerName} just uploaded <strong>${input.fileName}</strong> for their ${input.service}. It's sitting in the order's document drawer until someone verifies or rejects it.`,
      ctaLabel: "Review it",
      ctaUrl: input.orderUrl,
    }),
    orgName
  );
}

/** A document was verified or rejected — tell the customer, and give the reason when rejected. */
export async function sendDocumentReviewedEmail(input: {
  customerName: string;
  customerEmail: string;
  service: string;
  fileName: string;
  status: "verified" | "rejected";
  reviewNote?: string | null;
  orderUrl: string;
  orgName?: string;
}) {
  const orgName = input.orgName ?? SITE_NAME;
  const rejected = input.status === "rejected";
  // The reason is the entire point of the rejection email — it was
  // previously only visible to a customer who happened to log in and
  // open the drawer, so a rejected document just silently stalled.
  const extra =
    rejected && input.reviewNote
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;background:#fbeae8;border-radius:12px;">
           <tr><td style="padding:14px 18px;font:13px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#8a1a13;"><strong>Why it was returned:</strong><br />${input.reviewNote}</td></tr>
         </table>`
      : "";
  await sendDocumentMail(
    input.customerEmail,
    rejected ? `Action needed: ${input.fileName} was returned` : `${input.fileName} has been verified`,
    renderDocumentShell({
      orgName,
      bannerColor: rejected ? "#fde2e2" : "#d0f4db",
      heading: rejected ? "One of your documents needs redoing" : "Document verified",
      body: rejected
        ? `Hi ${input.customerName.split(" ")[0]}, we couldn't accept <strong>${input.fileName}</strong> for your ${input.service}. Please upload a replacement so we can carry on.`
        : `Hi ${input.customerName.split(" ")[0]}, <strong>${input.fileName}</strong> for your ${input.service} has been checked and accepted. Nothing further needed on this one.`,
      ctaLabel: rejected ? "Upload a replacement" : "View your order",
      ctaUrl: input.orderUrl,
      extra,
    }),
    orgName
  );
}
