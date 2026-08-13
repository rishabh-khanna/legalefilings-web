# Activity Logging System - User Guide

## Overview

The Activity Logging System provides comprehensive tracking of user sessions, logins, page views, and actions across your platform. Platform admins and organization admins can monitor user activity, analyze usage patterns, and audit user actions.

## Features

### 1. **Session Tracking**
- Automatic session creation on login
- Device type detection (desktop/mobile/tablet)
- Browser and OS detection
- IP address logging
- Session duration tracking
- Automatic session closure for inactive users (60 minutes)

### 2. **Activity Logging**
- Page views with referrer tracking
- CRM actions (leads, orders, invoices)
- HRMS actions (attendance, leave, payroll)
- Finance actions (transactions, budgets)
- Document operations (upload/download)
- Export actions (CSV, PDF)
- Search queries

### 3. **Analytics Dashboard**
- Active user count
- Session statistics
- Activity category breakdown
- Daily active users chart
- Popular pages report
- Recent login history

### 4. **User Journey Timeline**
- Chronological view of all user actions
- Session-based grouping
- Visual timeline with activity details
- Metadata inspection for each action

## How to Use

### For Platform Admins

#### Access the Activity Dashboard

Navigate to: `/dashboard/platform/activity`

You'll see:
- **Overview Tab**: Statistics, charts, popular pages, recent logins
- **Activity Logs Tab**: Searchable table of all activities
- **Sessions Tab**: User sessions with device info and duration

#### View User Journey

Navigate to: `/dashboard/platform/activity/journey?user_id={USER_ID}`

Or for a specific session: `/dashboard/platform/activity/journey?session_id={SESSION_ID}`

#### Filter Activities

Use the filters at the top:
- **Date Range**: Last 24 hours, 7 days, 30 days, 90 days
- **Category**: Filter by activity type (auth, navigation, CRM, etc.)
- **Organization**: Filter by specific organization (platform admins only)

### For Developers

#### Track Page Views Automatically

Use the `usePageViewTracking` hook in your page components:

```tsx
import { usePageViewTracking } from "@/lib/use-activity-tracker";

export default function MyPage() {
  usePageViewTracking("My Page Title");
  
  return <div>...</div>;
}
```

#### Log Custom Activities

Use the `useActivityLogger` hook:

```tsx
import { useActivityLogger } from "@/lib/use-activity-tracker";

export default function LeadForm() {
  const { logLeadCreated } = useActivityLogger();
  
  async function handleSubmit(data) {
    const lead = await createLead(data);
    
    // Log the activity
    logLeadCreated(lead.id, lead.name);
  }
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

#### Available Logger Methods

```tsx
const logger = useActivityLogger();

// CRM
logger.logLeadCreated(leadId, leadName);
logger.logLeadUpdated(leadId, leadName, changes);
logger.logLeadConverted(leadId, leadName);
logger.logOrderCreated(orderId, orderName);
logger.logOrderUpdated(orderId, orderName);

// Invoices
logger.logInvoiceCreated(invoiceId, invoiceNumber);
logger.logInvoiceSent(invoiceId, invoiceNumber);
logger.logInvoicePaid(invoiceId, invoiceNumber, amount);

// HRMS
logger.logClockIn(location);
logger.logClockOut(location);
logger.logLeaveRequested(leaveId, days);

// Documents
logger.logFileUploaded(fileName, fileType);
logger.logFileDownloaded(fileName);

// Exports
logger.logCsvExported(exportType, recordCount);
logger.logPdfGenerated(documentType);

// Search
logger.logSearch(query, category);

// Generic
logger.log(category, action, {
  description: "Custom action",
  entityType: "entity_type",
  entityId: "123",
  entityName: "Entity Name",
  metadata: { key: "value" }
});
```

#### Server-Side Logging (API Routes)

```tsx
import { logActivityServer } from "@/lib/activity-logger";
import { getCurrentProfile } from "@/lib/current-profile";

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  
  // ... your business logic
  
  await logActivityServer(
    profile.id,
    profile.organization_id,
    {
      category: "invoice",
      action: "invoice_created",
      description: "Created invoice #INV-001",
      entityType: "invoice",
      entityId: invoice.id,
      entityName: invoice.invoice_number,
    },
    sessionId, // optional
    ipAddress  // optional
  );
  
  return NextResponse.json({ success: true });
}
```

## Database Schema

### Tables

**user_sessions**
- Tracks login sessions
- Stores device/browser/OS info
- IP address and location
- Active/inactive status

**activity_logs**
- Comprehensive activity log
- Links to user session
- Category and action enums
- Entity references (lead, order, etc.)
- Metadata JSON field for flexibility
- Performance tracking (duration_ms)

### Views

**login_history**
- Quick access to login attempts
- Success/failure tracking
- User and device info

**daily_active_users**
- Daily user count per organization
- Total action count

**popular_pages**
- Most visited pages (last 7 days)
- View count and unique visitors
- Average duration on page

## Cron Jobs

**End Inactive Sessions** - Runs hourly
- Path: `/api/cron/end-inactive-sessions`
- Schedule: `0 * * * *` (every hour)
- Purpose: Marks sessions as inactive after 60 minutes of no activity

## Security & Privacy

### Access Control

- **Platform Admins**: Can see all activity across all organizations
- **Organization Admins**: Can only see their organization's activity
- **Regular Users**: Cannot access activity logs

### Row Level Security (RLS)

All tables have RLS policies enforcing:
- Platform admin bypass for cross-org visibility
- Organization scoping for regular admins
- No direct access for customers/staff

### Data Retention

Activity logs are kept indefinitely by default. Consider implementing:
- Automatic archival after 90 days
- GDPR-compliant deletion on user request
- Anonymization of old records

## Performance Considerations

### Indexing

The migration includes indexes on:
- `user_id`, `organization_id`, `session_id`
- `created_at` (descending)
- `category`, `action`
- `entity_type`, `entity_id`
- `metadata` (GIN index for JSON queries)

### Best Practices

1. **Silent Failures**: Activity logging never throws errors - it logs to console and continues
2. **Async Logging**: All client-side logging is async and non-blocking
3. **Batch Queries**: Use the views for analytics instead of raw queries
4. **Pagination**: Always use limit/offset when querying activity_logs

## Example Queries

### Most Active Users (Last 7 Days)

```sql
SELECT 
  p.full_name,
  p.email,
  COUNT(*) as activity_count
FROM activity_logs al
JOIN profiles p ON p.id = al.user_id
WHERE al.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY p.id, p.full_name, p.email
ORDER BY activity_count DESC
LIMIT 10;
```

### Failed Login Attempts

```sql
SELECT * FROM login_history
WHERE success = false
ORDER BY login_time DESC
LIMIT 20;
```

### Page Views by Hour

```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as views
FROM activity_logs
WHERE category = 'navigation' 
  AND action = 'page_view'
  AND created_at >= CURRENT_DATE - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

## Mobile Responsive Features

### Mobile-Friendly Tables

The system automatically switches to card view on mobile devices (<768px).

Use the `MobileDataTable` component:

```tsx
import { MobileDataTable, MobileLeadCard } from "@/components/MobileDataTable";

<MobileDataTable
  columns={columns}
  rows={rows}
  getRowKey={(row) => row.id}
  mobileCardRender={(row) => <MobileLeadCard lead={row} />}
/>
```

### CSS Utilities

Added mobile-friendly utilities in `globals.css`:
- `.mobile-card-table` - Auto card view on mobile
- `.touch-action-btn` - Touch-friendly 44px min size
- `.mobile-bottom-nav` - Fixed bottom navigation
- `.mobile-filter-drawer` - Slide-up filter panel
- `.kanban-column` - Responsive Kanban boards

## Troubleshooting

### Activities Not Showing Up

1. Check RLS policies - ensure your user has permission
2. Verify the API route is being called (Network tab)
3. Check browser console for errors
4. Ensure database migration has been applied

### Session Not Created on Login

1. Check if user authentication is working
2. Verify IP address is being captured correctly
3. Check `user_sessions` table directly
4. Look for errors in server logs

### Performance Issues

1. Add date range filters to limit query scope
2. Use pagination for large datasets
3. Consider archiving old logs
4. Check database indexes are created

## Next Steps

Consider implementing:
- **Real-time notifications** for suspicious activity
- **Anomaly detection** for unusual patterns
- **Geolocation tracking** with IP-to-location service
- **Export to external analytics** (Google Analytics, Mixpanel)
- **Automated reports** sent to admins weekly
- **Activity heatmaps** showing usage patterns

## Support

For questions or issues:
1. Check the codebase comments in `/src/lib/activity-logger.ts`
2. Review the migration file: `/supabase/migrations/20260912000000_user_activity_logging.sql`
3. Inspect the dashboard code: `/src/app/dashboard/platform/activity/page.tsx`
