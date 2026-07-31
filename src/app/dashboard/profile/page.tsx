"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { StateSelect } from "@/components/StateSelect";
import { CitySelect } from "@/components/CitySelect";

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Deferred (not called synchronously in the effect body) — same pattern
    // used elsewhere in this codebase (CountdownTimer, AiAssistant) to avoid
    // the cascading-render lint rule.
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setEmail(user.email ?? "");
      if (profile) {
        setName(profile.full_name ?? "");
        setPhone(profile.phone ?? "");
        setCompany(profile.company ?? "");
        setCity(profile.city ?? "");
        setState(profile.state ?? "");
        setDateOfBirth(profile.date_of_birth ?? "");
      }
      setLoading(false);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ full_name: name, phone, company, city, state, date_of_birth: dateOfBirth || null })
        .eq("id", user.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-sm font-medium mb-1";

  if (loading) {
    return (
      <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
        Loading…
      </p>
    );
  }

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
          <input id="profile-email" type="email" value={email} disabled className={`${inputClass} opacity-60`} style={{ borderColor: "var(--color-line)" }} />
        </div>
        <div>
          <label htmlFor="profile-phone" className={labelClass} style={{ color: "var(--color-ink)" }}>
            Phone
          </label>
          <input id="profile-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
        </div>
        <div>
          <label htmlFor="profile-dob" className={labelClass} style={{ color: "var(--color-ink)" }}>
            Date of Birth
          </label>
          <input id="profile-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>We&apos;ll send you a birthday surprise 🎂</p>
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
            Saved.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
          style={{ backgroundColor: "var(--color-action)" }}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
