// Every upload route in this app previously accepted any file at all —
// no MIME/extension allow-list, no server-side size cap (only whatever
// the browser happened to enforce, which is nothing). A staff/customer
// could upload a spoofed-extension executable or an oversized file with
// no pushback. This is deliberately simple (extension + declared MIME
// type, not true magic-byte content sniffing, which would need an extra
// dependency) — meaningfully better than no check at all, not a claim
// of bulletproof file-type detection.
export type UploadRule = { allowedExtensions: string[]; allowedMimeTypes: string[]; maxBytes: number };

// KYC/business documents (PAN, Aadhaar, address proof, receipts,
// agreements) — photos or scans of paper documents, so images + PDF
// covers the real world; no office-document formats since those aren't
// what a phone camera or scanner produces.
export const DOCUMENT_UPLOAD_RULE: UploadRule = {
  allowedExtensions: ["pdf", "jpg", "jpeg", "png", "webp"],
  allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  maxBytes: 10 * 1024 * 1024, // 10 MB
};

// Company branding assets (logo, signature) — always uploaded to a
// PUBLIC bucket, so no SVG (can carry embedded script) even though it's
// otherwise a reasonable logo format.
export const IMAGE_UPLOAD_RULE: UploadRule = {
  allowedExtensions: ["jpg", "jpeg", "png", "webp"],
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxBytes: 3 * 1024 * 1024, // 3 MB
};

// Returns an error message to show the caller, or null if the file's fine.
export function validateUpload(file: File, rule: UploadRule): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!rule.allowedExtensions.includes(ext)) {
    return `That file type isn't allowed. Accepted: ${rule.allowedExtensions.join(", ")}.`;
  }
  // Browsers/tools sometimes send an empty content type for a
  // legitimate file — only reject when a type WAS declared and it
  // doesn't match, rather than requiring one.
  if (file.type && !rule.allowedMimeTypes.includes(file.type)) {
    return `That file type isn't allowed. Accepted: ${rule.allowedExtensions.join(", ")}.`;
  }
  if (file.size > rule.maxBytes) {
    return `File is too large — max ${Math.round(rule.maxBytes / (1024 * 1024))} MB.`;
  }
  return null;
}
