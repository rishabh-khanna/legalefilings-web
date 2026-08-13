# Activity Logging & Mobile CRM - Implementation Checklist

## Database Setup

- [ ] Run the migration: `supabase/migrations/20260912000000_user_activity_logging.sql`
  ```bash
  # If using Supabase CLI
  supabase db push
  
  # Or apply manually via Supabase dashboard SQL editor
  ```

- [ ] Verify tables created:
  - `user_sessions`
  - `activity_logs`
  
- [ ] Verify views created:
  - `login_history`
  - `daily_active_users`
  - `popular_pages`

- [ ] Verify RLS policies are active

## Cron Job Setup

- [ ] Add cron job to vercel.json (already done in code)
- [ ] Deploy to Vercel
- [ ] Verify cron job is scheduled in Vercel dashboard
- [ ] Test cron endpoint manually:
  ```bash
  curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
       https://your-domain.com/api/cron/end-inactive-sessions
  ```

## Integration Steps

### 1. Add Activity Tracking to Login Flow

Update your login API route to create a session:

```tsx
// In your login API route
import { createUserSession } from "@/lib/activity-logger";

// After successful login
const sessionId = await createUserSession({
  userId: user.id,
  organizationId: profile.organization_id,
  ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0],
  userAgent: req.headers.get("user-agent") || "",
});

// Store session ID in cookie for future activity logs
res.cookies.set("session_id", sessionId, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 7, // 7 days
});

// Log the login activity
await logActivityServer(
  user.id,
  profile.organization_id,
  {
    category: "auth",
    action: "login",
    description: "User logged in",
  },
  sessionId,
  ipAddress
);
```

### 2. Add Activity Tracking to Logout

```tsx
// In your logout API route
import { endUserSession } from "@/lib/activity-logger";

const sessionId = req.cookies.get("session_id")?.value;
if (sessionId) {
  await endUserSession(sessionId);
}

await logActivityServer(
  user.id,
  profile.organization_id,
  {
    category: "auth",
    action: "logout",
  },
  sessionId,
  ipAddress
);
```

### 3. Add Page View Tracking

Add to your main layout or individual pages:

```tsx
// src/app/dashboard/layout.tsx
"use client";

import { usePageViewTracking } from "@/lib/use-activity-tracker";

export default function DashboardLayout({ children }) {
  usePageViewTracking("Dashboard");
  
  return <div>{children}</div>;
}
```

### 4. Add Action Tracking to CRM

```tsx
// In your lead creation form
import { useActivityLogger } from "@/lib/use-activity-tracker";

export default function LeadForm() {
  const { logLeadCreated } = useActivityLogger();
  
  async function handleSubmit(data) {
    const res = await fetch("/api/leads", {
      method: "POST",
      body: JSON.stringify(data),
    });
    
    const lead = await res.json();
    logLeadCreated(lead.id, lead.name);
  }
}
```

### 5. Add Navigation Links

Update your sidebar/navigation to include:

```tsx
// For platform admins only
{profile.is_platform_admin && (
  <Link href="/dashboard/platform/activity">
    <Activity size={20} />
    <span>Activity Monitor</span>
  </Link>
)}
```

## Mobile CRM Updates

### 1. Use Mobile-Friendly Components

Replace existing DataTable usage with MobileDataTable:

```tsx
import { MobileDataTable, MobileLeadCard } from "@/components/MobileDataTable";

<MobileDataTable
  columns={columns}
  rows={leads}
  getRowKey={(lead) => lead.id}
  mobileCardRender={(lead) => <MobileLeadCard lead={lead} />}
  search={{ placeholder: "Search leads...", filter: (lead, q) => ... }}
  exportFilename="leads"
/>
```

### 2. Add Mobile Breakpoints

Use responsive Tailwind classes:

```tsx
// Before: Always 4 columns
<div className="grid grid-cols-4 gap-4">

// After: 1 column on mobile, 4 on desktop
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```

### 3. Touch-Friendly Buttons

Add minimum touch target sizes:

```tsx
// Add touch-action-btn class for mobile
<button className="touch-action-btn rounded-lg px-4 py-2">
  Click Me
</button>
```

## Testing Checklist

### Activity Logging

- [ ] Login creates a session in `user_sessions`
- [ ] Login creates an activity log entry
- [ ] Page views are logged when navigating
- [ ] CRM actions (create/update lead) are logged
- [ ] Session is marked as inactive after 60 minutes
- [ ] Logout ends the session properly
- [ ] Failed login attempts are logged

### Dashboard Access

- [ ] Platform admin can access `/dashboard/platform/activity`
- [ ] Org admin can access and sees only their org data
- [ ] Regular users cannot access the page (403/404)
- [ ] Stats load correctly
- [ ] Charts render properly
- [ ] Recent logins show up
- [ ] Popular pages are displayed

### User Journey

- [ ] Can view journey by user_id
- [ ] Can view journey by session_id
- [ ] Timeline displays activities in order
- [ ] Activity metadata is visible
- [ ] Duration between actions is calculated

### Mobile Responsiveness

- [ ] Tables switch to card view on mobile (<768px)
- [ ] Buttons are touch-friendly (44px min)
- [ ] Forms are usable on mobile
- [ ] Navigation works on small screens
- [ ] Filters are accessible on mobile
- [ ] Modals fit on small screens

## Performance Verification

- [ ] Activity logging doesn't slow down page loads
- [ ] API routes respond quickly (<500ms)
- [ ] Database queries use proper indexes
- [ ] Dashboard loads in <2 seconds
- [ ] No N+1 queries in activity logs
- [ ] Pagination works for large datasets

## Security Verification

- [ ] RLS policies prevent unauthorized access
- [ ] Platform admins can see all orgs
- [ ] Org admins see only their org
- [ ] Regular users cannot query activity logs
- [ ] Session IDs are stored in httpOnly cookies
- [ ] IP addresses are anonymized if required by GDPR
- [ ] Sensitive data is not logged in metadata

## Documentation

- [ ] Team is trained on using the activity dashboard
- [ ] Developers know how to add activity tracking
- [ ] Privacy policy updated to mention activity logging
- [ ] Data retention policy is defined
- [ ] GDPR compliance reviewed

## Production Deployment

- [ ] Environment variables are set:
  - `CRON_SECRET` (for cron authentication)
  - All Supabase credentials
  
- [ ] Migrations applied to production database
- [ ] Cron jobs are active in Vercel
- [ ] Monitoring/alerting set up for errors
- [ ] Database backups are enabled
- [ ] Performance monitoring is in place

## Optional Enhancements

- [ ] Real-time activity feed using Supabase Realtime
- [ ] Email alerts for suspicious activity
- [ ] Export activity logs to CSV
- [ ] Integrate with external analytics (Google Analytics)
- [ ] Add activity-based user segmentation
- [ ] Create automated weekly reports
- [ ] Implement activity-based gamification
- [ ] Add IP geolocation for better location tracking
- [ ] Create activity heatmaps
- [ ] Implement anomaly detection

## Rollback Plan

If issues arise:

1. **Disable activity logging**:
   ```tsx
   // In activity-logger.ts, make all functions no-ops
   export async function logActivity() { return; }
   ```

2. **Stop cron job**:
   - Remove from vercel.json
   - Redeploy

3. **Revert migration** (if needed):
   ```sql
   DROP TABLE IF EXISTS activity_logs CASCADE;
   DROP TABLE IF EXISTS user_sessions CASCADE;
   DROP VIEW IF EXISTS login_history;
   DROP VIEW IF EXISTS daily_active_users;
   DROP VIEW IF EXISTS popular_pages;
   ```

## Support Contacts

- **Technical Issues**: [Your team contact]
- **Database Questions**: [Database admin contact]
- **Privacy/Legal**: [Legal team contact]

## Notes

- Activity logging is designed to fail silently - errors won't break user experience
- Start with basic page view tracking, add detailed action tracking gradually
- Review popular pages weekly to optimize user experience
- Use activity data to inform product decisions
