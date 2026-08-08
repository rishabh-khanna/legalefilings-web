import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DELEGABLE_TOOLS, isGrantActive } from "@/lib/tool-grants";

// Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
// (function renamed `middleware` -> `proxy`) — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
//
// Screen-level role gate. Everything under /dashboard requires a signed-in
// account; /dashboard/admin/* additionally requires being staff or admin
// (a customer has no business there), and a few specific sections within
// it are further restricted by seniority:
// - Account requests and "Create User" are viewable by any staff level —
//   a non-admin submits a request instead of creating directly (the page
//   itself branches on role); only admin can actually create an account
//   or approve/reject a request — those checks live in the respective
//   API routes, not here.
// - Analytics (company-wide revenue/headcount numbers) is admin or
//   group_leader — a rater/leader doesn't need visibility into the whole
//   company's financials to do their job.
// - Leads CRM, attendance, leave requests, and buying a plan for a
//   customer are open to any staff level — each of those pages further
//   scopes *what* a non-admin sees (their own team, via reports_to) at
//   the data-fetch layer, not here.
// - Payroll, HR letters, reports, and business settings are admin-only —
//   salary data and legally significant documents, not a rater/leader
//   day-to-day task.
const ADMIN_ONLY_SECTIONS: string[] = [
  "/dashboard/admin/payroll",
  "/dashboard/admin/payslips",
  "/dashboard/admin/hr-letters",
  "/dashboard/admin/reports",
  "/dashboard/admin/business-settings",
  "/dashboard/admin/employees",
  "/dashboard/admin/departments",
  "/dashboard/admin/email-failures",
  "/dashboard/admin/product-catalog",
  "/dashboard/admin/leave-types",
  // Grant/revoke management itself is never delegable — only an org
  // admin decides who else gets delegated into an admin-only section.
  "/dashboard/admin/tool-access",
];
const GROUP_LEADER_UP_SECTIONS = ["/dashboard/admin/analytics"];
const STAFF_UP_PREFIX = "/dashboard/admin";
const PLATFORM_ADMIN_PREFIX = "/dashboard/platform";
// CRM access is time-boxed (bundled free with a plan purchase, not
// permanent — see org_access_requests, Phase 4) — these stay reachable
// even once an org's access has lapsed, so someone can still see why
// and log out, rather than being locked out of the app entirely.
const EXPIRY_ALLOWLIST = ["/dashboard/access-expired", "/dashboard/profile"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, staff_level, is_platform_admin, organization_id, is_active")
    .eq("id", user.id)
    .single();
  const bounce = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  };

  if (!profile) return bounce();

  // A deactivated employee (admin.employees soft-delete) also gets their
  // Supabase Auth account banned, but that only blocks their *next token
  // refresh* — an access token issued before the ban stays technically
  // valid for up to its own lifetime (commonly ~1hr), during which they'd
  // otherwise keep full access. Checking is_active here closes that
  // window immediately, at the app layer, on every request — not just
  // whenever their token happens to need refreshing.
  if (profile.is_active === false) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Org access expiry gate — runs on every /dashboard/* page, not just
  // /dashboard/admin/*, since plenty of CRM pages (leads, invoices,
  // attendance...) live outside that prefix. Doesn't apply to a customer
  // (no CRM access to lose) or a platform_admin (not bound to one org).
  if (
    profile.account_type !== "customer" &&
    !profile.is_platform_admin &&
    !EXPIRY_ALLOWLIST.some((p) => path.startsWith(p))
  ) {
    const { data: org } = await supabase.from("organizations").select("access_expires_at").eq("id", profile.organization_id).single();
    if (org?.access_expires_at && new Date(org.access_expires_at) < new Date()) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/access-expired";
      return NextResponse.redirect(url);
    }
  }

  if (path.startsWith(STAFF_UP_PREFIX) || path.startsWith(PLATFORM_ADMIN_PREFIX)) {
    // Platform section is a separate axis from account_type/staff_level —
    // Legal Efilings operator only, regardless of which org they belong to.
    if (path.startsWith(PLATFORM_ADMIN_PREFIX)) {
      return profile.is_platform_admin ? response : bounce();
    }

    if (profile.account_type === "customer") return bounce();

    const needsAdmin = ADMIN_ONLY_SECTIONS.some((p) => path.startsWith(p)) && profile.account_type !== "admin";
    const needsGroupLeaderUp =
      GROUP_LEADER_UP_SECTIONS.some((p) => path.startsWith(p)) &&
      profile.account_type !== "admin" &&
      profile.staff_level !== "group_leader" &&
      !profile.is_platform_admin;

    if (needsAdmin || needsGroupLeaderUp) {
      // A staff member without the role that normally unlocks this
      // section may still have been individually delegated access to
      // it (see staff_tool_grants / src/lib/tool-grants.ts) — check for
      // a live grant before bouncing them.
      const matchedTool = DELEGABLE_TOOLS.find((t) => path.startsWith(t.path));
      const { data: grant } = matchedTool
        ? await supabase.from("staff_tool_grants").select("expires_at").eq("tool_key", matchedTool.key).maybeSingle()
        : { data: null };
      if (!grant || !isGrantActive(grant)) return bounce();
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
