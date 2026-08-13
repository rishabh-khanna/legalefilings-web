"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { Spinner } from "@/components/Spinner";
import { ArrowRight, Clock, MapPin, Mouse, FileText, Download, Upload, Eye, Edit3, Trash2 } from "lucide-react";

type Activity = {
  id: string;
  category: string;
  action: string;
  description: string | null;
  page_path: string | null;
  page_title: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  metadata: Record<string, any>;
  created_at: string;
};

type JourneySession = {
  sessionId: string | null;
  activities: Activity[];
  startTime: string;
  endTime: string;
  activityCount: number;
};

const ACTION_ICONS: Record<string, any> = {
  page_view: Eye,
  create: Edit3,
  update: Edit3,
  delete: Trash2,
  file_uploaded: Upload,
  file_downloaded: Download,
  search: Mouse,
  login: MapPin,
  logout: MapPin,
};

const CATEGORY_COLORS: Record<string, string> = {
  auth: "var(--color-info)",
  navigation: "var(--color-ink-soft)",
  crm: "var(--color-action)",
  invoice: "var(--color-success)",
  hrms: "var(--color-warning)",
  finance: "var(--color-purple, #8b5cf6)",
  admin: "var(--color-danger)",
  settings: "var(--color-ink)",
  document: "var(--color-info)",
  export: "var(--color-success)",
};

export default function UserJourneyPage() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("user_id");
  const sessionId = searchParams.get("session_id");
  
  const [journey, setJourney] = useState<JourneySession[] | Activity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    const loadJourney = async () => {
      if (!userId && !sessionId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      
      try {
        const params = new URLSearchParams();
        if (userId) params.set("user_id", userId);
        if (sessionId) params.set("session_id", sessionId);
        if (userId && !sessionId) params.set("days", "30"); // Last 30 days for user journey
        
        const res = await fetch(`/api/activity/user-journey?${params}`);
        const data = await res.json();
        
        if (res.ok) {
          setJourney(sessionId ? data.journey : data.journey);
          
          // Get user info if we have activities
          const activities = sessionId ? data.journey : data.journey[0]?.activities;
          if (activities && activities.length > 0 && userId) {
            // Fetch user profile
            const userRes = await fetch(`/api/profiles/${userId}`);
            if (userRes.ok) {
              const userData = await userRes.json();
              setUserEmail(userData.profile?.email || userId);
            }
          }
        }
      } catch (error) {
        console.error("Error loading journey:", error);
      } finally {
        setLoading(false);
      }
    };

    loadJourney();
  }, [userId, sessionId]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (start: string, end: string) => {
    const durationMs = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const ActivityIcon = ({ action }: { action: string }) => {
    const Icon = ACTION_ICONS[action] || FileText;
    return <Icon size={16} />;
  };

  const ActivityTimeline = ({ activities }: { activities: Activity[] }) => (
    <div className="space-y-4">
      {activities.map((activity, idx) => {
        const nextActivity = activities[idx + 1];
        const duration = nextActivity
          ? formatDuration(activity.created_at, nextActivity.created_at)
          : null;

        return (
          <div key={activity.id} className="relative">
            {/* Timeline connector */}
            {idx < activities.length - 1 && (
              <div
                className="absolute left-6 top-12 h-full w-0.5"
                style={{ backgroundColor: "var(--color-line)" }}
              />
            )}

            {/* Activity card */}
            <div className="flex gap-4">
              {/* Icon */}
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${CATEGORY_COLORS[activity.category]}20`,
                  color: CATEGORY_COLORS[activity.category],
                }}
              >
                <ActivityIcon action={activity.action} />
              </div>

              {/* Content */}
              <div className="flex-1 rounded-xl border bg-white p-4" style={{ borderColor: "var(--color-line)" }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold uppercase"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[activity.category]}20`,
                          color: CATEGORY_COLORS[activity.category],
                        }}
                      >
                        {activity.category}
                      </span>
                      <span className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                        {activity.action.replace(/_/g, " ")}
                      </span>
                    </div>

                    {activity.description && (
                      <p className="mt-1 text-sm" style={{ color: "var(--color-ink)" }}>
                        {activity.description}
                      </p>
                    )}

                    {activity.page_path && (
                      <p className="mt-1 font-mono text-xs" style={{ color: "var(--color-ink-soft)" }}>
                        {activity.page_path}
                      </p>
                    )}

                    {activity.entity_name && (
                      <p className="mt-1 text-xs" style={{ color: "var(--color-action)" }}>
                        {activity.entity_type}: {activity.entity_name}
                      </p>
                    )}

                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>
                          View metadata
                        </summary>
                        <pre className="mt-1 rounded bg-gray-50 p-2 text-xs" style={{ color: "var(--color-ink-soft)" }}>
                          {JSON.stringify(activity.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                      {formatTime(activity.created_at)}
                    </p>
                    {duration && (
                      <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>
                        {duration} later
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div>
        <DashboardPageHero title="User Journey" subtitle="Timeline of user activities" />
        <div className="flex justify-center py-12">
          <Spinner label="Loading journey..." />
        </div>
      </div>
    );
  }

  if (!userId && !sessionId) {
    return (
      <div>
        <DashboardPageHero title="User Journey" subtitle="Timeline of user activities" />
        <div className="mt-6 rounded-2xl border bg-white p-8 text-center" style={{ borderColor: "var(--color-line)" }}>
          <p style={{ color: "var(--color-ink-soft)" }}>
            Please provide a user_id or session_id in the URL to view journey.
          </p>
        </div>
      </div>
    );
  }

  const isSingleSession = sessionId || (journey && !Array.isArray(journey[0]));
  const activities = isSingleSession
    ? (journey as Activity[])
    : null;
  const sessions = !isSingleSession && journey
    ? (journey as JourneySession[])
    : null;

  return (
    <div>
      <DashboardPageHero
        title="User Journey"
        subtitle={userEmail ? `Activity timeline for ${userEmail}` : "Timeline of user activities"}
      />

      {/* Single Session View */}
      {isSingleSession && activities && activities.length > 0 && (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between rounded-xl border bg-white p-4" style={{ borderColor: "var(--color-line)" }}>
            <div className="flex items-center gap-3">
              <Clock size={20} style={{ color: "var(--color-action)" }} />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                  Session Duration
                </p>
                <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                  {formatDuration(activities[0].created_at, activities[activities.length - 1].created_at)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                {activities.length} Activities
              </p>
              <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                {new Date(activities[0].created_at).toLocaleDateString("en-IN")}
              </p>
            </div>
          </div>

          <ActivityTimeline activities={activities} />
        </div>
      )}

      {/* Multi-Session View */}
      {sessions && sessions.length > 0 && (
        <div className="mt-6 space-y-6">
          {sessions.map((session, idx) => (
            <div key={session.sessionId || idx} className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "var(--color-line)" }}>
              <div className="border-b bg-gray-50 px-4 py-3" style={{ borderColor: "var(--color-line)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>
                      Session {sessions.length - idx}
                    </h3>
                    <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                      {new Date(session.startTime).toLocaleDateString("en-IN")} •{" "}
                      {formatDuration(session.startTime, session.endTime)} •{" "}
                      {session.activityCount} activities
                    </p>
                  </div>
                  {session.sessionId && (
                    <a
                      href={`/dashboard/platform/activity/journey?session_id=${session.sessionId}`}
                      className="text-xs font-medium"
                      style={{ color: "var(--color-action)" }}
                    >
                      View Details →
                    </a>
                  )}
                </div>
              </div>
              
              <div className="p-4">
                <ActivityTimeline activities={session.activities.slice(0, 5)} />
                {session.activities.length > 5 && (
                  <p className="mt-4 text-center text-xs" style={{ color: "var(--color-ink-soft)" }}>
                    + {session.activities.length - 5} more activities
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {((isSingleSession && (!activities || activities.length === 0)) ||
        (!isSingleSession && (!sessions || sessions.length === 0))) && (
        <div className="mt-6 rounded-2xl border bg-white p-8 text-center" style={{ borderColor: "var(--color-line)" }}>
          <p style={{ color: "var(--color-ink-soft)" }}>No activity found for this {sessionId ? "session" : "user"}.</p>
        </div>
      )}
    </div>
  );
}
