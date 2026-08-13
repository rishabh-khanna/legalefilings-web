// React Hook for Activity Tracking
// Automatically tracks page views and provides helpers for logging actions

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { logActivity, logPageView, type ActivityCategory, type ActivityAction } from "./activity-logger";

/**
 * Hook to automatically track page views
 * Place this in your layout or individual pages
 */
export function usePageViewTracking(pageTitle?: string) {
  const pathname = usePathname();
  const hasTracked = useRef(false);

  useEffect(() => {
    // Track page view once on mount
    if (!hasTracked.current) {
      logPageView(pathname, pageTitle);
      hasTracked.current = true;
    }
  }, [pathname, pageTitle]);
}

/**
 * Hook to get activity logger with helper methods
 * Returns methods to log common activities
 */
export function useActivityLogger() {
  const log = (category: ActivityCategory, action: ActivityAction, details?: {
    description?: string;
    entityType?: string;
    entityId?: string;
    entityName?: string;
    metadata?: Record<string, any>;
  }) => {
    logActivity({
      category,
      action,
      description: details?.description,
      entityType: details?.entityType,
      entityId: details?.entityId,
      entityName: details?.entityName,
      metadata: details?.metadata,
    });
  };

  return {
    // Generic logger
    log,
    
    // CRM actions
    logLeadCreated: (leadId: string, leadName: string) => 
      log("crm", "lead_created", { entityType: "lead", entityId: leadId, entityName: leadName }),
    
    logLeadUpdated: (leadId: string, leadName: string, changes?: Record<string, any>) =>
      log("crm", "lead_updated", { entityType: "lead", entityId: leadId, entityName: leadName, metadata: changes }),
    
    logLeadConverted: (leadId: string, leadName: string) =>
      log("crm", "lead_converted", { entityType: "lead", entityId: leadId, entityName: leadName }),
    
    logOrderCreated: (orderId: string, orderName: string) =>
      log("crm", "order_created", { entityType: "order", entityId: orderId, entityName: orderName }),
    
    logOrderUpdated: (orderId: string, orderName: string) =>
      log("crm", "order_updated", { entityType: "order", entityId: orderId, entityName: orderName }),
    
    // Invoice actions
    logInvoiceCreated: (invoiceId: string, invoiceNumber: string) =>
      log("invoice", "invoice_created", { entityType: "invoice", entityId: invoiceId, entityName: invoiceNumber }),
    
    logInvoiceSent: (invoiceId: string, invoiceNumber: string) =>
      log("invoice", "invoice_sent", { entityType: "invoice", entityId: invoiceId, entityName: invoiceNumber }),
    
    logInvoicePaid: (invoiceId: string, invoiceNumber: string, amount?: number) =>
      log("invoice", "invoice_paid", { entityType: "invoice", entityId: invoiceId, entityName: invoiceNumber, metadata: { amount } }),
    
    // HRMS actions
    logClockIn: (location?: { latitude: number; longitude: number }) =>
      log("hrms", "clock_in", { metadata: { location } }),
    
    logClockOut: (location?: { latitude: number; longitude: number }) =>
      log("hrms", "clock_out", { metadata: { location } }),
    
    logLeaveRequested: (leaveId: string, days: number) =>
      log("hrms", "leave_requested", { entityType: "leave_request", entityId: leaveId, metadata: { days } }),
    
    // Document actions
    logFileUploaded: (fileName: string, fileType: string) =>
      log("document", "file_uploaded", { description: fileName, metadata: { fileType } }),
    
    logFileDownloaded: (fileName: string) =>
      log("document", "file_downloaded", { description: fileName }),
    
    // Export actions
    logCsvExported: (exportType: string, recordCount: number) =>
      log("export", "csv_exported", { description: exportType, metadata: { recordCount } }),
    
    logPdfGenerated: (documentType: string) =>
      log("export", "pdf_generated", { description: documentType }),
    
    // Search
    logSearch: (query: string, category?: string) =>
      log("navigation", "search", { description: query, metadata: { category } }),
  };
}
