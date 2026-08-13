// Activity Logger - Client and Server-side activity tracking
// Comprehensive logging of user actions, page views, and system events

import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Type definitions matching database enums
export type ActivityCategory =
  | "auth"
  | "navigation"
  | "crm"
  | "invoice"
  | "hrms"
  | "finance"
  | "admin"
  | "settings"
  | "document"
  | "export";

export type ActivityAction =
  // Generic CRUD
  | "create"
  | "read"
  | "update"
  | "delete"
  // Navigation
  | "page_view"
  | "search"
  // Auth
  | "login"
  | "logout"
  | "login_failed"
  // CRM specific
  | "lead_created"
  | "lead_updated"
  | "lead_converted"
  | "lead_assigned"
  | "order_created"
  | "order_updated"
  | "order_assigned"
  | "order_completed"
  | "invoice_created"
  | "invoice_sent"
  | "invoice_paid"
  | "invoice_reminded"
  // HRMS specific
  | "clock_in"
  | "clock_out"
  | "leave_requested"
  | "leave_approved"
  | "leave_rejected"
  | "payslip_generated"
  | "attendance_corrected"
  // Finance specific
  | "transaction_added"
  | "budget_set"
  | "bill_paid"
  // Documents
  | "file_uploaded"
  | "file_downloaded"
  | "file_deleted"
  // Exports
  | "csv_exported"
  | "pdf_generated";

export type ActivityLog = {
  category: ActivityCategory;
  action: ActivityAction;
  description?: string;
  pageePath?: string;
  pageTitle?: string;
  referrer?: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  metadata?: Record<string, any>;
  durationMs?: number;
};

export type UserSession = {
  id?: string;
  userId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: "desktop" | "mobile" | "tablet";
  browser?: string;
  os?: string;
  country?: string;
  city?: string;
};

// Browser detection helper
function detectDeviceType(userAgent: string): "desktop" | "mobile" | "tablet" {
  const ua = userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet";
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

function parseBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("firefox")) return "Firefox";
  if (ua.includes("edg")) return "Edge";
  if (ua.includes("chrome")) return "Chrome";
  if (ua.includes("safari")) return "Safari";
  if (ua.includes("opera") || ua.includes("opr")) return "Opera";
  return "Unknown";
}

function parseOS(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("win")) return "Windows";
  if (ua.includes("mac")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS";
  return "Unknown";
}

// ============================================================================
// SERVER-SIDE LOGGING
// ============================================================================

/**
 * Create a new user session (server-side only)
 * Call this on successful login
 */
export async function createUserSession(
  session: UserSession
): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    
    const userAgent = session.userAgent || "";
    
    const { data, error } = await supabase
      .from("user_sessions")
      .insert({
        user_id: session.userId,
        organization_id: session.organizationId,
        ip_address: session.ipAddress,
        user_agent: userAgent,
        device_type: session.deviceType || detectDeviceType(userAgent),
        browser: session.browser || parseBrowser(userAgent),
        os: session.os || parseOS(userAgent),
        country: session.country,
        city: session.city,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create user session:", error);
      return null;
    }

    return data.id;
  } catch (err) {
    console.error("Error creating user session:", err);
    return null;
  }
}

/**
 * End a user session (server-side only)
 * Call this on logout or session expiry
 */
export async function endUserSession(sessionId: string): Promise<void> {
  try {
    const supabase = await createServerClient();
    
    await supabase
      .from("user_sessions")
      .update({
        is_active: false,
        session_end: new Date().toISOString(),
      })
      .eq("id", sessionId);
  } catch (err) {
    console.error("Error ending user session:", err);
  }
}

/**
 * Log an activity (server-side)
 * Use this in API routes
 */
export async function logActivityServer(
  userId: string,
  organizationId: string,
  log: ActivityLog,
  sessionId?: string | null,
  ipAddress?: string
): Promise<void> {
  try {
    const supabase = await createServerClient();
    
    await supabase.from("activity_logs").insert({
      session_id: sessionId,
      user_id: userId,
      organization_id: organizationId,
      category: log.category,
      action: log.action,
      description: log.description,
      page_path: log.pagePath,
      page_title: log.pageTitle,
      referrer: log.referrer,
      entity_type: log.entityType,
      entity_id: log.entityId,
      entity_name: log.entityName,
      metadata: log.metadata || {},
      duration_ms: log.durationMs,
      ip_address: ipAddress,
    });
  } catch (err) {
    // Silent fail - we don't want activity logging to break the app
    console.error("Error logging activity:", err);
  }
}

// ============================================================================
// CLIENT-SIDE LOGGING
// ============================================================================

/**
 * Log an activity (client-side)
 * Use this in React components
 */
export async function logActivity(log: ActivityLog): Promise<void> {
  try {
    // Call our API route which will handle server-side logging
    await fetch("/api/activity/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(log),
    });
  } catch (err) {
    // Silent fail
    console.error("Error logging activity:", err);
  }
}

/**
 * Log a page view (client-side)
 * Call this in useEffect on page mount
 */
export function logPageView(path: string, title?: string, referrer?: string): void {
  logActivity({
    category: "navigation",
    action: "page_view",
    pagePath: path,
    pageTitle: title || document.title,
    referrer: referrer || document.referrer,
  });
}

/**
 * Track action duration
 * Wraps an async function and logs execution time
 */
export async function trackDuration<T>(
  category: ActivityCategory,
  action: ActivityAction,
  description: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - startTime);
    
    logActivity({
      category,
      action,
      description,
      durationMs,
    });
    
    return result;
  } catch (err) {
    const durationMs = Math.round(performance.now() - startTime);
    
    logActivity({
      category,
      action,
      description: `${description} (failed)`,
      durationMs,
      metadata: { error: err instanceof Error ? err.message : "Unknown error" },
    });
    
    throw err;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get user agent details from browser
 */
export function getUserAgentInfo(): {
  userAgent: string;
  deviceType: "desktop" | "mobile" | "tablet";
  browser: string;
  os: string;
} {
  const userAgent = navigator.userAgent;
  return {
    userAgent,
    deviceType: detectDeviceType(userAgent),
    browser: parseBrowser(userAgent),
    os: parseOS(userAgent),
  };
}
