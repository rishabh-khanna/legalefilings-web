"use client";

import { useEffect, useState } from "react";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

// Client-side pagination over an already-fetched array — every dashboard
// table currently loads its full result set in one API call rather than
// paging server-side, so slicing here (instead of re-plumbing every list
// API with limit/offset) is the low-risk way to add "20/50/100 per page"
// without touching data-fetching or RLS-scoped queries.
export function usePagination<T>(items: T[], initialPageSize: number = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // If a filter (elsewhere in the page) shrinks the source array while
  // sitting on, say, page 4 of what's now only 2 pages, clamp back
  // instead of rendering an empty page with no way to get back.
  useEffect(() => {
    if (page > totalPages) {
      const kickoff = setTimeout(() => setPage(totalPages), 0);
      return () => clearTimeout(kickoff);
    }
  }, [page, totalPages]);

  function setPageSize(size: number) {
    setPageSizeState(size);
    setPage(1);
  }

  const clampedPage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const end = Math.min(clampedPage * pageSize, total);
  const pageItems = items.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  return { page: clampedPage, setPage, pageSize, setPageSize, pageItems, totalPages, total, start, end };
}
