"use client";

import { useEffect, useState } from "react";
import { getDemoSession } from "@/lib/demo-auth";
import { StateSelect } from "@/components/StateSelect";
import { CitySelect } from "@/components/CitySelect";

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Deferred (not called synchronously in the effect body) — same pattern
    // used elsewhere in this codebase (CountdownTimer, AiAssistant) to avoid
    // the cascading-render lint rule.
    const kickoff = setTimeout(() => {
      const session = getDemoSession();
      if (session) {
        setName(session.name);
        setEmail(session.email);
      }
      setPhone("+91 98765 43210");
      setCompany("Bloom Retail Pvt Ltd");
      setCity("Mumbai");
      setState("Maharashtra");
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // No backend yet — this just confirms the form works.
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-sm font-medium mb-1";

  return (
    <div>
      <h1 className="text-2xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
        Edit Profile
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
        Keep your account details up to date.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 max-w-lg space-y-4 rounded-2xl border bg-white p-6 dark:bg-[var(--color-paper-raised)]"
        style={{ borderColor: "var(--color-line)" }}
      >
        <div>
          <label htmlFor="profile-name" className={labelClass} style={{ color: "var(--color-ink)" }}>
            Full Name
          </label>
          <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
        </div>
        <div>
          <label htmlFor="profile-company" className={labelClass} style={{ color: "var(--color-ink)" }}>
            Company
          </label>
          <input id="profile-company" value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
        </div>
        <div>
          <label htmlFor="profile-email" className={labelClass} style={{ color: "var(--color-ink)" }}>
            Email
          </label>
          <input id="profile-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
        </div>
        <div>
          <label htmlFor="profile-phone" className={labelClass} style={{ color: "var(--color-ink)" }}>
            Phone
          </label>
          <input id="profile-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="profile-state" className={labelClass} style={{ color: "var(--color-ink)" }}>
              State
            </label>
            <StateSelect
              id="profile-state"
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setCity("");
              }}
              className={inputClass}
              style={{ borderColor: "var(--color-line)" }}
            />
          </div>
          <div>
            <label htmlFor="profile-city" className={labelClass} style={{ color: "var(--color-ink)" }}>
              City
            </label>
            <CitySelect
              id="profile-city"
              state={state}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
              style={{ borderColor: "var(--color-line)" }}
            />
          </div>
        </div>

        {saved && (
          <p className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "#d0f4db", color: "#116a2c" }}>
            Saved — though there&apos;s no backend yet, so this won&apos;t persist after a refresh.
          </p>
        )}

        <button
          type="submit"
          className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: "var(--color-action)" }}
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
