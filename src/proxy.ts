import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
// - Payroll, HR letters, reports, and company settings are admin-only —
//   salary data and legally significant documents, not a rater/leader
//   day-to-day task.
const ADMIN_ONLY_SECTIONS: string[] = [
  "/dashboard/admin/payroll",
  "/dashboard/admin/hr-letters",
  "/dashboard/admin/reports",
  "/dashboard/admin/company-settings",
  "/dashboard/admin/employees",
];
const GROUP_LEADER_UP_SECTIONS = ["/dashboard/admin/analytics"];
const STAFF_UP_PREFIX = "/dashboard/admin";

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

  if (path.startsWith(STAFF_UP_PREFIX)) {
    const { data: profile } = await supabase.from("profiles").select("account_type, staff_level").eq("id", user.id).single();
    const bounce = () => {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    };

    if (!profile || profile.account_type === "customer") return bounce();

    if (ADMIN_ONLY_SECTIONS.some((p) => path.startsWith(p)) && profile.account_type !== "admin") {
      return bounce();
    }
    if (
      GROUP_LEADER_UP_SECTIONS.some((p) => path.startsWith(p)) &&
      profile.account_type !== "admin" &&
      profile.staff_level !== "group_leader"
    ) {
      return bounce();
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
