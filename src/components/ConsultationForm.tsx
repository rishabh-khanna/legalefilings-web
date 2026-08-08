"use client";

import { useState } from "react";
import { FORM_COPY } from "@/config/copy";
import { StateSelect } from "@/components/StateSelect";
import { CitySelect } from "@/components/CitySelect";

type Status = "idle" | "submitting" | "success" | "error";

export type SelectedPlan = { name: string; price: string };

export function ConsultationForm({
  serviceTitle,
  plan,
  variant = "light",
  orgSlug,
}: {
  serviceTitle?: string;
  /** Which pricing tier the user picked before opening this form, if any — carried through to the lead record so it's there for the payment step later. */
  plan?: SelectedPlan;
  variant?: "light" | "dark";
  /** A tenant org's own public lead-capture page (see /org/[slug]) passes
   * its slug through so the lead lands in that org instead of Legal
   * Efilings' own — every other use of this form (the main site) omits
   * it, which keeps the existing default behavior. */
  orgSlug?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState("");
  const dark = variant === "dark";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: data.get("name"),
      email: data.get("email"),
      phone: `+91${data.get("phone")}`,
      city: data.get("city"),
      state: data.get("state"),
      service: serviceTitle,
      plan: plan?.name,
      planPrice: plan?.price,
      orgSlug,
    };

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong");
      }
      setStatus("success");
      form.reset();
      setSelectedState("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "success") {
    return (
      <div
        className="rounded-lg border p-6 text-center"
        style={{
          borderColor: "var(--color-line)",
          backgroundColor: dark ? "var(--color-accent-tint)" : "var(--color-paper)",
        }}
      >
        <p className="font-medium" style={{ color: "var(--color-ink)" }}>
          Thanks — we&apos;ve got your details.
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--color-ink-soft)" }}>
          Our team will reach out shortly{serviceTitle ? ` about ${serviceTitle}` : ""}
          {plan ? ` (${plan.name} plan)` : ""}.
        </p>
      </div>
    );
  }

  // "dark" here now means "the featured/branded card" — a white card with
  // a bold gradient top bar and a visible shadow, so it clearly reads as
  // a distinct form panel floating above the page. The previous pass used
  // the same pale accent tint as the surrounding hero background, so the
  // card's edge disappeared into the page and it stopped reading as a
  // form at all; navy before that was the opposite problem (too heavy).
  const inputClass = "w-full appearance-none rounded-lg px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-soft)] outline-none bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-action)] focus:bg-white";
  const inputStyle = undefined;
  const labelClass = "block text-sm font-medium mb-1";

  return (
    <form
      id="consultation-form"
      onSubmit={handleSubmit}
      className={`rounded-2xl p-6 space-y-3.5 ${dark ? "border-t-[6px] shadow-[0_2px_8px_rgba(0,0,0,0.06),0_24px_48px_rgba(0,0,0,0.10)]" : "border"}`}
      style={dark ? { backgroundColor: "#ffffff", borderTopColor: "var(--color-accent)" } : { borderColor: "var(--color-line)" }}
    >
      <div className={dark ? "text-center" : undefined}>
        <h3
          className="font-extrabold text-xl"
          style={{ fontFamily: "var(--font-display)", color: "var(--color-ink)" }}
        >
          {serviceTitle ? `Get a quote for ${serviceTitle}` : "Consult Our Experts"}
        </h3>
        {plan && (
          <span
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-action-dark)" }}
          >
            {plan.name} — {plan.price}
          </span>
        )}
      </div>
      <div>
        <label htmlFor="name" className={labelClass} style={{ color: "var(--color-ink)" }}>
          Name
        </label>
        <input id="name" name="name" required className={inputClass} style={inputStyle} />
      </div>
      <div>
        <label htmlFor="email" className={labelClass} style={{ color: "var(--color-ink)" }}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="phone" className={labelClass} style={{ color: "var(--color-ink)" }}>
          Contact Number
        </label>
        <div className="flex">
          <span
            className="flex items-center rounded-l-lg border border-r-0 px-3 text-sm"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)", backgroundColor: "var(--color-paper)" }}
          >
            +91
          </span>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]{10}"
            maxLength={10}
            required
            className={`${inputClass} rounded-l-none`}
            style={inputStyle}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="state" className={labelClass} style={{ color: "var(--color-ink)" }}>
            State
          </label>
          <StateSelect
            className={inputClass}
            style={inputStyle}
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="city" className={labelClass} style={{ color: "var(--color-ink)" }}>
            City
          </label>
          <CitySelect key={selectedState} state={selectedState} className={inputClass} style={inputStyle} />
        </div>
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-full text-white text-sm font-semibold py-2.5 transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
        style={{ backgroundColor: "var(--color-action)" }}
      >
        {status === "submitting" ? FORM_COPY.submittingLabel : FORM_COPY.submitLabel}
      </button>
      <p className="text-xs text-center" style={{ color: "var(--color-ink-soft)" }}>
        {FORM_COPY.privacyNote}
      </p>
    </form>
  );
}
