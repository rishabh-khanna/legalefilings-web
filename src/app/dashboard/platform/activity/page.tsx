"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { Spinner } from "@/components/Spinner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users, Activity, Clock, Eye, TrendingUp } from "lucide-react";

type ActivityLog = {
  id: string;
  user_id: string;
  organization_id: string;
  category: string;
  action: string;
  description: string | null;
  page_path: string | null;
  page_title: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string;
    account_type: string;
  };
};

type UserSession = {
  id: string;
  user_id: string;
  organization_id: string;
  session_start: string;
  session_end: string | null;
  last_activity: string;
  is_active: boolean;
  ip_address: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  profiles: {
    full_name: string | null;
    email: string;
    account_type: string;
  };
};

type Stats = {
  activeUsers: number;
  totalSessions: number;
  activeSessions: number;
  totalActivities: number;
  categoryBreakdown: Record<string, number>;
};

export default function ActivityDashboardPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "sessions" | "journey">("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<ActivityLog[] | null>(null);
  const [sessions, setSessions] = useState<UserSession[] | null>(null);
  const [popularPages, setPopularPages] = useState<any[] | null>(null);
  const [recentLogins, setRecentLogins] = useState<any[] | null>(null);
  const [dailyActiveUsers, setDailyActiveUsers] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [dateRange, setDateRange] = useState<number>(7); // days

  const loadData = useCallback(async () => {
    setLoading(true);
    
    try {
      // Build query params
      const params = new URLSearchParams();
      if (selectedOrgId) params.set("org_id", selectedOrgId);
      if (dateRange) params.set("days", dateRange.toString());

      // Load stats
      const statsRes = await fetch(`/api/activity/stats?${params}`);
      const statsData = await statsRes.json();
      
      if (statsRes.ok) {
        setStats(statsData.stats);
        setPopularPages(statsData.popularPages);
        setRecentLogins(statsData.recentLogins);
        setDailyActiveUsers(statsData.dailyActiveUsers);
      }

      // Load logs if on logs tab
      if (activeTab === "logs") {
        const logsParams = new URLSearchParams(params);
        if (selectedCategory) logsParams.set("category", selectedCategory);
        if (selectedUserId) logsParams.set("user_id", selectedUserId);
        logsParams.set("limit", "100");
        
        const logsRes = await fetch(`/api/activity/logs?${logsParams}`);
        const logsData = await logsRes.json();
        if (logsRes.ok) setLogs(logsData.logs);
      }

      // Load sessions if on sessions tab
      if (activeTab === "sessions") {
        const sessionsParams = new URLSearchParams(params);
        if (selectedUserId) sessionsParams.set("user_id", selectedUserId);
        sessionsParams.set("limit", "100");
        
        const sessionsRes = await fetch(`/api/activity/sessions?${sessionsParams}`);
        const sessionsData = await sessionsRes.json();
        if (sessionsRes.ok) setSessions(sessionsData.sessions);
      }
    } catch (error) {
      console.error("Error loading activity data:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedOrgId, selectedCategory, selectedUserId, dateRange]);

  useEffect(() => {
    const kickoff = setTimeout(loadData, 0);
    return () => clearTimeout(kickoff);
  }, [loadData]);

  // Chart colors
  const COLORS = [
    "var(--color-action)",
    "var(--color-success)",
    "var(--color-info)",
    "var(--color-danger)",
    "var(--color-warning)",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
  ];

  const categoryData = stats
    ? Object.entries(stats.categoryBreakdown).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }))
    : [];

  const logColumns: DataTableColumn<ActivityLog>[] = [
    {
      key: "user",
      header: "User",
      render: (log) => (
        <>
          <p className="font-medium" style={{ color: "var(--color-ink)" }}>
            {log.profiles.full_name || "Unknown"}
          </p>
          <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
            {log.profiles.email}
          </p>
        </>
      ),
      exportValue: (log) => log.profiles.full_name || log.profiles.email,
      sortValue: (log) => log.profiles.full_name || log.profiles.email,
    },
    {
      key: "activity",
      header: "Activity",
      render: (log) => (
        <>
          <p className="font-medium" style={{ color: "var(--color-ink)" }}>
            {log.action.replace(/_/g, " ")}
          </p>
          <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
            {log.category}
          </p>
        </>
      ),
      exportValue: (log) => log.action,
      sortValue: (log) => log.action,
    },
    {
      key: "details",
      header: "Details",
      render: (log) => (
        <>
          {log.description && (
            <p className="text-sm" style={{ color: "var(--color-ink)" }}>
              {log.description}
            </p>
          )}
          {log.page_path && (
            <p className="text-xs font-mono" style={{ color: "var(--color-ink-soft)" }}>
              {log.page_path}
            </p>
          )}
          {log.entity_name && (
            <p className="text-xs" style={{ color: "var(--color-action)" }}>
              {log.entity_type}: {log.entity_name}
            </p>
          )}
        </>
      ),
      exportValue: (log) => log.description || log.page_path || "",
    },
    {
      key: "timestamp",
      header: "Time",
      className: "w-[14%] whitespace-nowrap",
      render: (log) => (
        <>
          <p className="text-sm" style={{ color: "var(--color-ink)" }}>
            {new Date(log.created_at).toLocaleDateString("en-IN")}
          </p>
          <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
            {new Date(log.created_at).toLocaleTimeString("en-IN")}
          </p>
        </>
      ),
      exportValue: (log) => new Date(log.created_at).toLocaleString("en-IN"),
      sortValue: (log) => log.created_at,
    },
  ];

  const sessionColumns: DataTableColumn<UserSession>[] = [
    {
      key: "user",
      header: "User",
      render: (session) => (
        <>
          <p className="font-medium" style={{ color: "var(--color-ink)" }}>
            {session.profiles.full_name || "Unknown"}
          </p>
          <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
            {session.profiles.email}
          </p>
        </>
      ),
      exportValue: (session) => session.profiles.full_name || session.profiles.email,
      sortValue: (session) => session.profiles.full_name || session.profiles.email,
    },
    {
      key: "device",
      header: "Device",
      render: (session) => (
        <>
          <p className="text-sm" style={{ color: "var(--color-ink)" }}>
            {session.device_type || "Unknown"}
          </p>
          <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
            {session.browser} on {session.os}
          </p>
        </>
      ),
      exportValue: (session) => `${session.device_type} - ${session.browser}`,
    },
    {
      key: "duration",
      header: "Duration",
      className: "w-[12%]",
      render: (session) => {
        const start = new Date(session.session_start);
        const end = session.session_end ? new Date(session.session_end) : new Date(session.last_activity);
        const durationMs = end.getTime() - start.getTime();
        const minutes = Math.floor(durationMs / 60000);
        const hours = Math.floor(minutes / 60);
        
        return (
          <p className="text-sm" style={{ color: "var(--color-ink)" }}>
            {hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`}
          </p>
        );
      },
      exportValue: (session) => {
        const start = new Date(session.session_start);
        const end = session.session_end ? new Date(session.session_end) : new Date(session.last_activity);
        return Math.floor((end.getTime() - start.getTime()) / 60000);
      },
      sortValue: (session) => {
        const start = new Date(session.session_start);
        const end = session.session_end ? new Date(session.session_end) : new Date(session.last_activity);
        return end.getTime() - start.getTime();
      },
    },
    {
      key: "status",
      header: "Status",
      className: "w-[10%]",
      render: (session) => (
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold"
          style={
            session.is_active
              ? { backgroundColor: "var(--color-success-tint)", color: "var(--color-success)" }
              : { backgroundColor: "var(--color-ink-tint)", color: "var(--color-ink-soft)" }
          }
        >
          {session.is_active ? "Active" : "Ended"}
        </span>
      ),
      exportValue: (session) => (session.is_active ? "Active" : "Ended"),
      sortValue: (session) => (session.is_active ? 1 : 0),
    },
    {
      key: "ip",
      header: "IP Address",
      className: "w-[12%]",
      render: (session) => (
        <p className="text-xs font-mono" style={{ color: "var(--color-ink-soft)" }}>
          {session.ip_address || "N/A"}
        </p>
      ),
      exportValue: (session) => session.ip_address || "",
    },
    {
      key: "started",
      header: "Started",
      className: "w-[14%] whitespace-nowrap",
      render: (session) => (
        <>
          <p className="text-sm" style={{ color: "var(--color-ink)" }}>
            {new Date(session.session_start).toLocaleDateString("en-IN")}
          </p>
          <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
            {new Date(session.session_start).toLocaleTimeString("en-IN")}
          </p>
        </>
      ),
      exportValue: (session) => new Date(session.session_start).toLocaleString("en-IN"),
      sortValue: (session) => session.session_start,
    },
  ];

  return (
    <div>
      <DashboardPageHero
        title="User Activity Monitor"
        subtitle="Comprehensive tracking of user sessions, logins, page views, and actions across the platform."
      />

      {/* Filters */}
      <div className="mt-6 overflow-hidden rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--color-line)" }}>
          <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>Filters</h3>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-ink)" }}>Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(parseInt(e.target.value))}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
              style={{ borderColor: "var(--color-line)" }}
            >
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
          
          {activeTab === "logs" && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-ink)" }}>Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
                style={{ borderColor: "var(--color-line)" }}
              >
                <option value="">All Categories</option>
                <option value="auth">Auth</option>
                <option value="navigation">Navigation</option>
                <option value="crm">CRM</option>
                <option value="invoice">Invoice</option>
                <option value="hrms">HRMS</option>
                <option value="finance">Finance</option>
                <option value="admin">Admin</option>
                <option value="settings">Settings</option>
                <option value="document">Document</option>
                <option value="export">Export</option>
              </select>
            </div>
          )}
          
          <div className="flex items-end">
            <button
              onClick={loadData}
              className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: "var(--color-action)" }}
            >
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-2 border-b" style={{ borderColor: "var(--color-line)" }}>
        {[
          { key: "overview", label: "Overview", icon: TrendingUp },
          { key: "logs", label: "Activity Logs", icon: Activity },
          { key: "sessions", label: "Sessions", icon: Clock },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className="inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              borderColor: activeTab === key ? "var(--color-action)" : "transparent",
              color: activeTab === key ? "var(--color-action)" : "var(--color-ink-soft)",
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner label="Loading activity data..." />
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === "overview" && stats && (
            <div className="mt-6 space-y-6">
              {/* Stats Cards */}
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="overflow-hidden rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-line)" }}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg p-2" style={{ backgroundColor: "var(--color-success-tint)" }}>
                      <Users size={20} style={{ color: "var(--color-success)" }} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>{stats.activeUsers}</p>
                      <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Active Users</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-line)" }}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg p-2" style={{ backgroundColor: "var(--color-info-tint)" }}>
                      <Clock size={20} style={{ color: "var(--color-info)" }} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>{stats.totalSessions}</p>
                      <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Total Sessions</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-line)" }}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg p-2" style={{ backgroundColor: "var(--color-warning-tint)" }}>
                      <Eye size={20} style={{ color: "var(--color-warning)" }} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>{stats.activeSessions}</p>
                      <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Active Now</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-line)" }}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg p-2" style={{ backgroundColor: "var(--color-action-tint)" }}>
                      <Activity size={20} style={{ color: "var(--color-action)" }} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" style={{ color: "var(--color-ink)" }}>{stats.totalActivities}</p>
                      <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Total Activities</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Daily Active Users */}
                {dailyActiveUsers && dailyActiveUsers.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-line)" }}>
                    <h3 className="mb-4 font-semibold" style={{ color: "var(--color-ink)" }}>Daily Active Users</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={dailyActiveUsers}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                        <XAxis dataKey="activity_date" tick={{ fill: "var(--color-ink-soft)", fontSize: 12 }} />
                        <YAxis tick={{ fill: "var(--color-ink-soft)", fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--color-paper)",
                            borderColor: "var(--color-line)",
                            borderRadius: "8px",
                          }}
                        />
                        <Line type="monotone" dataKey="active_users" stroke="var(--color-action)" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Category Breakdown */}
                {categoryData.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border bg-white p-4" style={{ borderColor: "var(--color-line)" }}>
                    <h3 className="mb-4 font-semibold" style={{ color: "var(--color-ink)" }}>Activity by Category</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => entry.name}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Popular Pages */}
              {popularPages && popularPages.length > 0 && (
                <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "var(--color-line)" }}>
                  <div className="border-b px-4 py-3" style={{ borderColor: "var(--color-line)" }}>
                    <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>Most Visited Pages (Last 7 Days)</h3>
                  </div>
                  <div className="p-4">
                    <div className="space-y-3">
                      {popularPages.map((page, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                              {page.page_title || page.page_path}
                            </p>
                            <p className="text-xs font-mono" style={{ color: "var(--color-ink-soft)" }}>
                              {page.page_path}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold" style={{ color: "var(--color-action)" }}>
                              {page.view_count} views
                            </p>
                            <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                              {page.unique_visitors} unique
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Logins */}
              {recentLogins && recentLogins.length > 0 && (
                <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "var(--color-line)" }}>
                  <div className="border-b px-4 py-3" style={{ borderColor: "var(--color-line)" }}>
                    <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>Recent Logins</h3>
                  </div>
                  <div className="p-4">
                    <div className="space-y-3">
                      {recentLogins.slice(0, 10).map((login, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                              {login.full_name || login.email}
                            </p>
                            <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                              {login.device_type} • {login.ip_address}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm" style={{ color: "var(--color-ink)" }}>
                              {new Date(login.login_time).toLocaleDateString("en-IN")}
                            </p>
                            <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                              {new Date(login.login_time).toLocaleTimeString("en-IN")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity Logs Tab */}
          {activeTab === "logs" && logs && (
            <div className="mt-6 overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "var(--color-line)" }}>
              <div className="border-b px-4 py-3" style={{ borderColor: "var(--color-line)" }}>
                <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>Activity Logs</h3>
                <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Comprehensive log of all user actions</p>
              </div>
              <div className="px-4 pb-4">
                <DataTable
                  columns={logColumns}
                  rows={logs}
                  getRowKey={(log) => log.id}
                  itemLabel="activities"
                  emptyMessage="No activity logs yet."
                  search={{ placeholder: "Search logs...", filter: (log, q) => log.profiles.email.toLowerCase().includes(q) || log.action.toLowerCase().includes(q) }}
                  exportFilename="activity-logs"
                  minWidth={800}
                />
              </div>
            </div>
          )}

          {/* Sessions Tab */}
          {activeTab === "sessions" && sessions && (
            <div className="mt-6 overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "var(--color-line)" }}>
              <div className="border-b px-4 py-3" style={{ borderColor: "var(--color-line)" }}>
                <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>User Sessions</h3>
                <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Login sessions with device info and duration</p>
              </div>
              <div className="px-4 pb-4">
                <DataTable
                  columns={sessionColumns}
                  rows={sessions}
                  getRowKey={(session) => session.id}
                  itemLabel="sessions"
                  emptyMessage="No sessions yet."
                  search={{ placeholder: "Search sessions...", filter: (session, q) => session.profiles.email.toLowerCase().includes(q) }}
                  exportFilename="user-sessions"
                  minWidth={900}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
