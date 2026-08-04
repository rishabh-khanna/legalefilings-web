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
};

// A self-contained, table-based HTML email (inline styles only, no external
// CSS/JS) — the layout choices here are deliberate for compatibility with
// Outlook desktop's old rendering engine, which ignores flexbox/grid.
function renderAcknowledgementHtml(lead: LeadAcknowledgementInput) {
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
                <img src="${logoUrl}" width="150" alt="${SITE_NAME}" style="display:block;border:0;" />
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
                  Thanks for reaching out to ${SITE_NAME}. We've logged your request and a real compliance expert will be in touch shortly — here's a quick summary of what you shared.
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
                <p style="margin:0 0 4px 0;font:600 13px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">${SITE_NAME}</p>
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
  const fromName = process.env.EMAIL_FROM_NAME ?? SITE_NAME;
  if (!fromAddress) throw new Error("Missing EMAIL_FROM_ADDRESS env var");

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: lead.email,
    subject: `We've received your request — ${SITE_NAME}`,
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
};

function renderPaymentRequestHtml(input: PaymentRequestInput) {
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

export async function sendPaymentRequestEmail(input: PaymentRequestInput) {
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME ?? SITE_NAME;
  if (!fromAddress) throw new Error("Missing EMAIL_FROM_ADDRESS env var");

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: input.customerEmail,
    subject: `Payment request for ${input.service} — ${SITE_NAME}`,
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
};

function renderPaymentConfirmationHtml(input: PaymentConfirmationInput) {
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
                <img src="${logoUrl}" width="150" alt="${SITE_NAME}" style="display:block;border:0;" />
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

export async function sendPaymentConfirmationEmail(input: PaymentConfirmationInput) {
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME ?? SITE_NAME;
  if (!fromAddress) throw new Error("Missing EMAIL_FROM_ADDRESS env var");

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: input.customerEmail,
    subject: `Payment received — ${input.invoiceNumber} — ${SITE_NAME}`,
    html: renderPaymentConfirmationHtml(input),
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

function renderBirthdayHtml(firstName: string) {
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
                <img src="${logoUrl}" width="150" alt="${SITE_NAME}" style="display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px;text-align:center;">
                <p style="margin:0;font-size:44px;line-height:1;">🎉🎂🎈</p>
                <p style="margin:20px 0 0 0;font:700 24px/1.3 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${ink};">Happy Birthday, ${firstName}!</p>
                <p style="margin:14px 0 0 0;font:14px/1.7 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${inkSoft};">
                  Wishing you a fantastic day filled with good things. Thank you for being part of the ${SITE_NAME} family — here's to another great year ahead!
                </p>
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

export async function sendBirthdayEmail(person: { name: string; email: string }) {
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME ?? SITE_NAME;
  if (!fromAddress) throw new Error("Missing EMAIL_FROM_ADDRESS env var");

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: person.email,
    subject: `🎂 Happy Birthday from ${SITE_NAME}!`,
    html: renderBirthdayHtml(person.name.split(" ")[0]),
  });
}
