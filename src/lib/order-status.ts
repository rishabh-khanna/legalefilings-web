// Single source of truth for the order pipeline status — was previously
// duplicated inline in OrdersTableClient.tsx with no way to actually
// change it (nothing but the payment webhook ever wrote new/assigned;
// in_progress/under_review/completed were dead states no code path
// could reach). Now shared with the staff status-change control in
// OrderDocumentsDrawer.tsx and the PATCH /api/orders/[id]/status route.
export type OrderStatus = "new" | "assigned" | "in_progress" | "under_review" | "completed" | "cancelled";

// "Under Review" means someone's actively looking at it, not that
// something's wrong — it stays out of the red/danger palette on
// purpose; that color read as an error when it was really just a
// normal, active pipeline stage.
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  assigned: "Assigned",
  in_progress: "In Progress",
  under_review: "Under Review",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_STYLE: Record<OrderStatus, { bg: string; fg: string }> = {
  new: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  assigned: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  in_progress: { bg: "#fff6d9", fg: "#8a6700" },
  under_review: { bg: "#dbe7ff", fg: "#1d4fb8" },
  completed: { bg: "#d0f4db", fg: "#116a2c" },
  cancelled: { bg: "var(--color-paper)", fg: "var(--color-ink-soft)" },
};

// The straight-line path a staff member moves an order along by hand.
// "cancelled" is reachable from any non-final state but isn't part of
// this forward progression — it's offered as a separate action.
export const ORDER_STATUS_FLOW: OrderStatus[] = ["new", "assigned", "in_progress", "under_review", "completed"];
