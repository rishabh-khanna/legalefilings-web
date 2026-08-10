import type { getSupabaseAdmin } from "@/lib/supabase-admin";

export type ExpenseBookRole = "owner" | "admin" | "accountant" | "employee" | "viewer";
export type ExpensePermission = "add_expense" | "delete_expense" | "view_reports" | "download_reports" | "manage_users" | "manage_accounts";

// Module 12's fixed role → permission matrix. Not per-user customizable
// (that's a real feature in its own right, and the spec only ever
// describes five named roles, not arbitrary permission sets) —
// * owner/admin: everything, including inviting/removing people and
//   opening/closing bank accounts.
// * accountant: can record entries and pull reports, can't rewrite
//   history (no delete) or touch the team/account structure.
// * employee: can record entries and see reports, nothing more —
//   matches "Employees submit expenses" from the spec's approval-
//   workflow description (that workflow itself is a later phase, but
//   the role's ceiling is set now).
// * viewer: read-only, including downloads (an auditor/investor role).
export const EXPENSE_ROLE_PERMISSIONS: Record<ExpenseBookRole, ExpensePermission[]> = {
  owner: ["add_expense", "delete_expense", "view_reports", "download_reports", "manage_users", "manage_accounts"],
  admin: ["add_expense", "delete_expense", "view_reports", "download_reports", "manage_users", "manage_accounts"],
  accountant: ["add_expense", "view_reports", "download_reports"],
  employee: ["add_expense", "view_reports"],
  viewer: ["view_reports", "download_reports"],
};

export type ExpenseBookAccess = { role: ExpenseBookRole; permissions: ExpensePermission[] };

// The one lookup every expense-manager route uses to answer "can this
// profile touch this particular customer's books, and with what
// ceiling" — the owner has a real row in expense_book_members too (see
// Phase 3 migration), so this is a single code path regardless of
// whether the caller is the original owner or someone they invited.
export async function getBookAccess(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  memberId: string,
  bookOwnerId: string
): Promise<ExpenseBookAccess | null> {
  const { data } = await supabase
    .from("expense_book_members")
    .select("role")
    .eq("book_owner_id", bookOwnerId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (!data) return null;
  const role = data.role as ExpenseBookRole;
  return { role, permissions: EXPENSE_ROLE_PERMISSIONS[role] };
}

export function hasPermission(access: ExpenseBookAccess | null, permission: ExpensePermission): boolean {
  return access?.permissions.includes(permission) ?? false;
}

// Module 15 — every action recorded, human-readable, not just a raw
// diff. Best-effort: a failed audit write shouldn't fail the action it
// was recording.
export async function logExpenseAudit(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  entry: { bookOwnerId: string; organizationId: string; actorId: string; action: string; entityType: string; entityId?: string; detail?: string }
) {
  try {
    await supabase.from("expense_audit_log").insert({
      book_owner_id: entry.bookOwnerId,
      organization_id: entry.organizationId,
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      detail: entry.detail ?? null,
    });
  } catch {
    // Best-effort — see comment above.
  }
}

type TransactionBalanceInput = {
  customer_id: string;
  transaction_type: "expense" | "income";
  payment_mode: "bank" | "cash" | "upi" | "cheque" | "card";
  account_id: string | null;
  amount: number;
  status: "pending" | "approved" | "rejected";
};

// "Automatic Bank Balance" / "Automatic Cash Book" (spec's Smart
// Automation #1 & #2) — every approved expense reduces the account/cash
// it was paid from, every approved income increases it. direction lets
// the same function apply a transaction's effect (1, on create) or
// reverse it (-1, on edit/delete) — editing is "reverse the old values,
// then apply the new ones" rather than a special-cased diff.
//
// Only 'approved' transactions move money — a 'pending' one (once the
// approval workflow phase turns status on for a business) shouldn't
// touch balances until a manager actually approves it, and a 'rejected'
// one never should.
//
// Both balance moves go through a single atomic UPDATE (see
// 20260902000000) rather than a SELECT-then-UPDATE from here. The old
// read-then-write silently lost a transaction whenever two landed on the
// same account close together — both would read the same starting
// balance and the second write would overwrite the first, erasing that
// amount from the ledger with no trace.
export async function applyExpenseBalanceEffect(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tx: TransactionBalanceInput,
  direction: 1 | -1
) {
  if (tx.status !== "approved") return;
  const sign = tx.transaction_type === "income" ? 1 : -1;
  const delta = sign * direction * Number(tx.amount);
  if (delta === 0) return;

  if (tx.payment_mode === "cash") {
    await supabase.rpc("apply_expense_cash_delta", { p_customer_id: tx.customer_id, p_delta: delta });
    return;
  }

  if (tx.account_id) {
    await supabase.rpc("apply_expense_account_delta", { p_account_id: tx.account_id, p_delta: delta });
  }
}
