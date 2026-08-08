"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";

type Book = { bookOwnerId: string; role: string; ownerName: string; isOwn: boolean };

// Only renders anything once a profile has access to more than one set
// of books (their own plus at least one they were invited onto) — an
// accountant working across several customers needs a way to switch
// between them; a plain customer with just their own books never sees
// this at all.
export function BookSwitcher({ bookOwnerId, onChange }: { bookOwnerId: string; onChange: (id: string) => void }) {
  const [books, setBooks] = useState<Book[] | null>(null);

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/expense-manager/my-books");
      const data = await res.json();
      if (res.ok) setBooks(data.books ?? []);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  if (!books || books.length <= 1) return null;

  return (
    <div className="mb-4 flex items-center gap-2">
      <Users className="h-4 w-4" style={{ color: "var(--color-ink-soft)" }} />
      <select
        value={bookOwnerId}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
        style={{ borderColor: "var(--color-line)" }}
      >
        {books.map((b) => (
          <option key={b.bookOwnerId} value={b.bookOwnerId}>
            {b.isOwn ? "My Books" : `${b.ownerName}'s Books`} — {b.role}
          </option>
        ))}
      </select>
    </div>
  );
}
