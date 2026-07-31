// Click-to-chat WhatsApp links (wa.me) — no API key, no Business account,
// no per-message cost. This opens a chat with a prefilled draft that a
// human still reviews and sends; it's not automated/programmatic sending
// (that needs the actual WhatsApp Business API — a Meta or Twilio/Gupshup
// account with real credentials, which nothing in this codebase has).
export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
