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
}: {
  serviceTitle?: string;
  /** Which pricing tier the user picked before opening this form, if any — carried through to the lead record so it's there for the payment step later. */
  plan?: SelectedPlan;
  variant?: "light" | "dark";
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
        className={`rounded-lg p-6 text-center ${dark ? "" : "border"}`}
        style={
          dark
            ? { backgroundColor: "var(--color-ink-fixed)" }
            : { borderColor: "var(--color-line)", backgroundColor: "var(--color-paper)" }
        }
      >
        <p className={`font-medium ${dark ? "text-white" : ""}`} style={dark ? undefined : { color: "var(--color-ink)" }}>
          Thanks — we&apos;ve got your details.
        </p>
        <p className={`text-sm mt-1 ${dark ? "text-white/70" : ""}`} style={dark ? undefined : { color: "var(--color-ink-soft)" }}>
          Our team will reach out shortly{serviceTitle ? ` about ${serviceTitle}` : ""}
          {plan ? ` (${plan.name} plan)` : ""}.
        </p>
      </div>
    );
  }

  const inputClass = dark
    ? "w-full rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/40 outline-none bg-white/10 border border-white/15 focus:border-white/40"
    : "w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-[var(--color-action)]";
  const inputStyle = dark ? undefined : { borderColor: "var(--color-line)" };
  const labelClass = dark ? "block text-sm font-medium text-white/90 mb-1" : "block text-sm font-medium mb-1";

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-lg p-5 space-y-3 ${dark ? "border-t-4" : "border"}`}
      style={dark ? { backgroundColor: "var(--color-ink-fixed)", borderColor: "var(--color-accent)" } : { borderColor: "var(--color-line)" }}
    >
      <div className={dark ? "text-center" : undefined}>
        <h3
          className="font-semibold text-lg"
          style={{ fontFamily: "var(--font-display)", color: dark ? "#ffffff" : "var(--color-ink)" }}
        >
          {serviceTitle ? `Get a quote for ${serviceTitle}` : "Consult Our Experts"}
        </h3>
        {plan && (
          <span
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={
              dark
                ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#ffffff" }
                : { backgroundColor: "var(--color-action-tint)", color: "var(--color-action-dark)" }
            }
          >
            {plan.name} — {plan.price}
          </span>
        )}
      </div>
      <div>
        <label htmlFor="name" className={labelClass} style={dark ? undefined : { color: "var(--color-ink)" }}>
          Name
        </label>
        <input id="name" name="name" required className={inputClass} style={inputStyle} />
      </div>
      <div>
        <label htmlFor="email" className={labelClass} style={dark ? undefined : { color: "var(--color-ink)" }}>
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
        <label htmlFor="phone" className={labelClass} style={dark ? undefined : { color: "var(--color-ink)" }}>
          Contact Number
        </label>
        <div className="flex">
          <span
            className={`flex items-center rounded-l-lg border border-r-0 px-3 text-sm ${dark ? "text-white/70 bg-white/10 border-white/15" : ""}`}
            style={dark ? undefined : { borderColor: "var(--color-line)", color: "var(--color-ink-soft)", backgroundColor: "var(--color-paper)" }}
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
          <label htmlFor="state" className={labelClass} style={dark ? undefined : { color: "var(--color-ink)" }}>
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
          <label htmlFor="city" className={labelClass} style={dark ? undefined : { color: "var(--color-ink)" }}>
            City
          </label>
          <CitySelect key={selectedState} state={selectedState} className={inputClass} style={inputStyle} />
        </div>
      </div>

      {status === "error" && (
        <p className={`text-sm ${dark ? "text-red-300" : "text-red-600"}`}>{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-full text-white text-sm font-semibold py-2.5 transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
        style={{ backgroundColor: "var(--color-action)" }}
      >
        {status === "submitting" ? FORM_COPY.submittingLabel : FORM_COPY.submitLabel}
      </button>
      <p className={`text-xs text-center ${dark ? "text-white/60" : ""}`} style={dark ? undefined : { color: "var(--color-ink-soft)" }}>
        {FORM_COPY.privacyNote}
      </p>
    </form>
  );
}
