"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  approveApproval,
  createTask,
  getApprovals,
  getTasks,
  rejectApproval,
  getAlerts,
  markAlertRead,
  markAllAlertsRead,
  getNotificationsWebSocketUrl,
  type AgentAlert,
} from "@/lib/api";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

type Approval = {
  id: string;
  task_id: string;
  action: string;
  status: string;
  created_at?: string;
};

const QUICK_TASKS = [
  {
    title: "Find today's delayed orders",
    description:
      "Find delayed orders, identify affected customers, and prepare follow-up actions.",
  },
  {
    title: "Follow up with new leads",
    description:
      "Review recent leads and prepare follow-up actions for customers who need attention.",
  },
  {
    title: "Summarize today's business activity",
    description:
      "Review today's business activity and prepare a concise operational summary.",
  },
];

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);

  const [notifications, setNotifications] = useState<AgentAlert[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);

      const [tasksData, approvalsData] = await Promise.all([
        getTasks(),
        getApprovals(),
      ]);

      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setApprovals(Array.isArray(approvalsData) ? approvalsData : []);
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    let mounted = true;
    let reconnectTimer: number | undefined;
    let reconnectDelay = 1000;
    let socket: WebSocket | null = null;

    const refreshNotifications = async () => {
      try {
        const data = await getAlerts();

        if (mounted) {
          setNotifications(data.slice(0, 8));
        }
      } catch (error) {
        console.error("Notification refresh error:", error);
      }
    };

    const connectWebSocket = () => {
      if (!mounted) return;

      const wsUrl = getNotificationsWebSocketUrl();

      if (!wsUrl) return;

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        reconnectDelay = 1000;
        void refreshNotifications();
      };

      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data);

          if (
            event.type === "alert.created" ||
            event.type === "alert.updated" ||
            event.type === "alert.resolved"
          ) {
            void refreshNotifications();
          }
        } catch (error) {
          console.error("Invalid notification event:", error);
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (!mounted) return;

        reconnectTimer = window.setTimeout(
          connectWebSocket,
          reconnectDelay,
        );

        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      };
    };

    // Initial notification load.
    void refreshNotifications();

    // Connect to real-time notifications.
    connectWebSocket();

    // Polling remains as a fallback and reconciliation mechanism.
    const interval = window.setInterval(
      refreshNotifications,
      30000,
    );

    return () => {
      mounted = false;

      window.clearInterval(interval);

      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }

      socket?.close();
    };
  }, []);

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (!cleanTitle || !cleanDescription) {
      return;
    }

    try {
      setCreating(true);

      await createTask(cleanTitle, cleanDescription);

      setTitle("");
      setDescription("");

      await loadDashboard();
    } catch (error) {
      console.error("Create task error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Failed to create task",
      );
    } finally {
      setCreating(false);
    }
  }

  function useQuickTask(
    quickTitle: string,
    quickDescription: string,
  ) {
    setTitle(quickTitle);
    setDescription(quickDescription);
  }

  async function handleApproval(
    approvalId: string,
    decision: "approve" | "reject",
  ) {
    try {
      if (decision === "approve") {
        await approveApproval(approvalId);
      } else {
        await rejectApproval(approvalId);
      }

      await loadDashboard();
    } catch (error) {
      console.error("Approval error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Failed to process approval",
      );
    }
  }

  async function markNotificationRead(alertId: string) {
    try {
      await markAlertRead(alertId);

      setNotifications((previous) =>
        previous.map((alert) =>
          alert.id === alertId
            ? { ...alert, is_read: true }
            : alert,
        ),
      );
    } catch (error) {
      console.error("Mark notification read error:", error);
    }
  }

  async function markAllNotificationsRead() {
    try {
      await markAllAlertsRead();

      setNotifications((previous) =>
        previous.map((alert) => ({
          ...alert,
          is_read: true,
        })),
      );
    } catch (error) {
      console.error("Mark all notifications read error:", error);
    }
  }

  const unreadCount = notifications.filter(
    (alert) => !alert.is_read,
  ).length;

  const stats = useMemo(() => {
    const pending = approvals.filter(
      (approval) => approval.status === "pending",
    ).length;

    const completed = tasks.filter(
      (task) => normalizeStatus(task.status) === "completed",
    ).length;

    const running = tasks.filter((task) =>
      ["running", "in_progress", "processing"].includes(
        normalizeStatus(task.status),
      ),
    ).length;

    const waiting = tasks.filter(
      (task) => normalizeStatus(task.status) === "waiting_approval",
    ).length;

    return {
      total: tasks.length,
      pending,
      completed,
      running,
      waiting,
    };
  }, [tasks, approvals]);

  const recentTasks = [...tasks]
    .sort((a, b) => {
      const aTime = new Date(
        a.updated_at || a.created_at || 0,
      ).getTime();

      const bTime = new Date(
        b.updated_at || b.created_at || 0,
      ).getTime();

      return bTime - aTime;
    })
    .slice(0, 6);

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-bold">
                A
              </div>

              <span className="text-sm font-medium text-zinc-400">
                AgentOS
              </span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              AI Operations Dashboard
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-zinc-500 md:text-base">
              Give AgentOS a business task and let it plan, execute,
              request approval, and keep a complete audit trail.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Notification bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationOpen((open) => !open)}
                aria-label="Notifications"
                className="relative rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>

                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-white/10 bg-[#0f0f11] shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <p className="text-sm font-medium">Notifications</p>

                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="text-xs text-blue-400 transition hover:text-blue-300"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-zinc-500">
                        No notifications yet
                      </p>
                    ) : (
                      notifications.map((alert) => {
                        const isRead = alert.is_read;

                        return (
                          <button
                            key={alert.id}
                            type="button"
                            onClick={() => markNotificationRead(alert.id)}
                            className={`flex w-full gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5 ${
                              isRead ? "opacity-60" : ""
                            }`}
                          >
                            <span
                              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                alert.severity === "critical"
                                  ? "bg-red-400"
                                  : "bg-yellow-400"
                              }`}
                            />

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {alert.title}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                                {alert.message}
                              </p>
                              <p className="mt-1 text-[10px] text-zinc-600">
                                {formatDate(alert.created_at)}
                              </p>
                            </div>

                            {!isRead && (
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  <Link
                    href="/alerts"
                    onClick={() => setNotificationOpen(false)}
                    className="block border-t border-white/10 px-4 py-3 text-center text-xs text-zinc-400 transition hover:text-white"
                  >
                    View all alerts →
                  </Link>
                </div>
              )}
            </div>

            <Link
              href="/tasks"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              Tasks
            </Link>

            <Link
              href="/approvals"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              Approvals
              {stats.pending > 0 && (
                <span className="ml-2 rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-400">
                  {stats.pending}
                </span>
              )}
            </Link>

            <Link
              href="/agents"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              Agents
            </Link>

            <Link
              href="/analytics"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              Analytics
            </Link>

            <Link
              href="/alerts"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              Alerts
            </Link>
          </div>
        </header>

        {/* Stats */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Total tasks"
            value={stats.total}
            description="All tasks"
          />

          <StatCard
            label="Running"
            value={stats.running}
            description="Currently executing"
          />

          <StatCard
            label="Waiting approval"
            value={stats.waiting}
            description="Human decision needed"
            highlight={stats.waiting > 0}
          />

          <StatCard
            label="Completed"
            value={stats.completed}
            description="Successfully finished"
          />

          <StatCard
            label="Approvals"
            value={stats.pending}
            description="Pending decisions"
            highlight={stats.pending > 0}
          />
        </section>

        {/* Create task */}
        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-wider text-blue-400">
              New AI task
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              What should AgentOS do?
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Describe the outcome you want. AgentOS will generate an
              execution plan automatically.
            </p>
          </div>

          <form
            onSubmit={handleCreateTask}
            className="space-y-4"
          >
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Find today's delayed orders"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500/50"
            />

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Describe what AgentOS should accomplish..."
              rows={4}
              className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500/50"
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-600">
                Human approval will be requested before sensitive
                actions.
              </p>

              <button
                type="submit"
                disabled={
                  creating ||
                  !title.trim() ||
                  !description.trim()
                }
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "Creating task..." : "Create AI Task"}
              </button>
            </div>
          </form>

          {/* Quick tasks */}
          <div className="mt-6 border-t border-white/5 pt-5">
            <p className="mb-3 text-xs uppercase tracking-wider text-zinc-600">
              Quick examples
            </p>

            <div className="flex flex-wrap gap-2">
              {QUICK_TASKS.map((task) => (
                <button
                  key={task.title}
                  type="button"
                  onClick={() =>
                    useQuickTask(
                      task.title,
                      task.description,
                    )
                  }
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-xs text-zinc-400 transition hover:border-white/20 hover:bg-white/5 hover:text-zinc-200"
                >
                  {task.title}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Main content */}
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Recent tasks */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Recent tasks
                </h2>

                <p className="mt-1 text-sm text-zinc-600">
                  Latest activity from your AI workforce.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={loadDashboard}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/10"
                >
                  Refresh
                </button>

                <Link
                  href="/tasks"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/10"
                >
                  View all
                </Link>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
                <p className="text-sm text-zinc-500">
                  Loading tasks...
                </p>
              </div>
            ) : recentTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                  ✦
                </div>

                <h3 className="font-medium">
                  No tasks yet
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
                  Create your first AI task above and AgentOS will
                  generate an execution plan.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20 hover:bg-white/[0.04]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <StatusDot status={task.status} />

                          <h3 className="truncate font-medium">
                            {task.title}
                          </h3>
                        </div>

                        {task.description && (
                          <p className="mt-2 line-clamp-2 text-sm text-zinc-500">
                            {task.description}
                          </p>
                        )}

                        <p className="mt-3 text-xs text-zinc-700">
                          {formatDate(
                            task.updated_at ||
                              task.created_at,
                          )}
                        </p>
                      </div>

                      <StatusBadge status={task.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Right sidebar */}
          <aside className="space-y-6">
            {/* Approval card */}
            <section className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.03] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-yellow-500/70">
                    Human oversight
                  </p>

                  <h2 className="mt-2 text-lg font-semibold">
                    Approval Center
                  </h2>
                </div>

                <span className="rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs text-yellow-400">
                  {stats.pending}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-zinc-500">
                Sensitive actions pause automatically until a human
                approves them.
              </p>

              <Link
                href="/approvals"
                className="mt-4 block rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5 text-center text-sm text-yellow-400 transition hover:bg-yellow-500/10"
              >
                Review approvals →
              </Link>
            </section>

            {/* Agent card */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-xs uppercase tracking-wider text-zinc-600">
                AI workforce
              </p>

              <h2 className="mt-2 text-lg font-semibold">
                Agents
              </h2>

              <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]" />

                  <div>
                    <p className="text-sm font-medium">
                      Operations Agent
                    </p>

                    <p className="mt-1 text-xs text-zinc-600">
                      Ready to execute tasks
                    </p>
                  </div>
                </div>
              </div>

              <Link
                href="/agents"
                className="mt-4 block text-center text-sm text-zinc-400 transition hover:text-white"
              >
                Manage agents →
              </Link>
            </section>

            {/* Architecture */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-xs uppercase tracking-wider text-zinc-600">
                Runtime
              </p>

              <div className="mt-4 space-y-3">
                <RuntimeItem
                  label="AI Planning"
                  status="Active"
                />

                <RuntimeItem
                  label="Tool Execution"
                  status="Active"
                />

                <RuntimeItem
                  label="Human Approval"
                  status="Active"
                />

                <RuntimeItem
                  label="Audit Logging"
                  status="Active"
                />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  description,
  highlight = false,
}: {
  label: string;
  value: number;
  description: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? "border-yellow-500/20 bg-yellow-500/[0.03]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-zinc-600">
        {label}
      </p>

      <p
        className={`mt-3 text-3xl font-semibold ${
          highlight ? "text-yellow-400" : "text-white"
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-xs text-zinc-600">
        {description}
      </p>
    </div>
  );
}

function RuntimeItem({
  label,
  status,
}: {
  label: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-400">{label}</span>

      <span className="flex items-center gap-2 text-xs text-green-400">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        {status}
      </span>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const normalized = normalizeStatus(status);

  const className =
    normalized === "completed"
      ? "bg-green-400"
      : normalized === "waiting_approval"
        ? "bg-yellow-400"
        : normalized === "failed"
          ? "bg-red-400"
          : "bg-blue-400";

  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${className}`}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);

  const styles =
    normalized === "completed"
      ? "bg-green-500/10 text-green-400"
      : normalized === "waiting_approval"
        ? "bg-yellow-500/10 text-yellow-400"
        : normalized === "failed"
          ? "bg-red-500/10 text-red-400"
          : "bg-blue-500/10 text-blue-400";

  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs capitalize ${styles}`}
    >
      {formatStatus(status)}
    </span>
  );
}

function normalizeStatus(status: string) {
  return status.toLowerCase().replace(/[\s-]+/g, "_");
}

function formatStatus(status: string) {
  return status
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value?: string) {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleString();
}