"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

type Task = {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type Approval = {
  id: string;
  task_id: string;
  action: string;
  status: string;
  created_at: string;
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const [tasksResponse, approvalsResponse] = await Promise.all([
        fetch(`${API_URL}/tasks/`),
        fetch(`${API_URL}/approvals/`),
      ]);

      if (!tasksResponse.ok || !approvalsResponse.ok) {
        throw new Error("Failed to load AgentOS data");
      }

      const tasksData = await tasksResponse.json();
      const approvalsData = await approvalsResponse.json();

      setTasks(tasksData);
      setApprovals(approvalsData);
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const pendingApprovals = approvals.filter(
    (approval) => approval.status === "pending"
  );

  const runningTasks = tasks.filter(
    (task) => task.status === "running"
  );

  const completedTasks = tasks.filter(
    (task) => task.status === "completed"
  );

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      {/* Sidebar */}
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-white/10 bg-[#0c0c0f] p-6 md:block">
          <div className="mb-10">
            <h1 className="text-2xl font-bold tracking-tight">
              Agent<span className="text-blue-500">OS</span>
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              AI Employee Platform
            </p>
          </div>

          <nav className="space-y-2">
            <NavItem href="/" active label="Dashboard" icon="⌂" />
            <NavItem href="/tasks" label="Tasks" icon="✓" />
            <NavItem href="/approvals" label="Approvals" icon="!" />
            <NavItem href="/agents" label="Agents" icon="✦" />
            <NavItem href="/audit" label="Audit Logs" icon="◷" />
          </nav>

          <div className="absolute bottom-6 w-52">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-zinc-500">System status</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm text-zinc-300">
                  All systems operational
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <section className="flex-1">
          <header className="border-b border-white/10 px-6 py-5 md:px-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-500">Workspace</p>
                <h2 className="text-xl font-semibold">
                  Operations Dashboard
                </h2>
              </div>

              <button
                onClick={loadData}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
              >
                Refresh
              </button>
            </div>
          </header>

          <div className="p-6 md:p-10">
            {/* Hero */}
            <div className="mb-8 rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 p-6">
              <p className="mb-2 text-sm text-blue-400">
                AI workforce
              </p>

              <h3 className="text-3xl font-semibold tracking-tight">
                Your AI employees are ready.
              </h3>

              <p className="mt-2 max-w-2xl text-zinc-400">
                Create tasks, let agents execute them, and keep humans in
                control of sensitive actions through approvals.
              </p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Tasks"
                value={tasks.length}
                description="All workspace tasks"
              />

              <StatCard
                title="Running"
                value={runningTasks.length}
                description="Currently executing"
              />

              <StatCard
                title="Pending Approval"
                value={pendingApprovals.length}
                description="Human action required"
              />

              <StatCard
                title="Completed"
                value={completedTasks.length}
                description="Successfully completed"
              />
            </div>

            {/* Content */}
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {/* Tasks */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
                <div className="border-b border-white/10 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Recent Tasks</h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        Agent execution activity
                      </p>
                    </div>

                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400">
                      {tasks.length}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-white/10">
                  {loading ? (
                    <div className="p-5 text-sm text-zinc-500">
                      Loading tasks...
                    </div>
                  ) : tasks.length === 0 ? (
                    <div className="p-5 text-sm text-zinc-500">
                      No tasks yet.
                    </div>
                  ) : (
                    tasks.slice(0, 5).map((task) => (
                      <Link
                        key={task.id}
                        href={`/tasks/${task.id}`}
                        className="block p-5 transition hover:bg-white/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="text-sm font-medium">
                              {task.title}
                            </h4>

                            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                              {task.description}
                            </p>
                          </div>

                          <StatusBadge status={task.status} />
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* Approvals */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
                <div className="border-b border-white/10 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Approvals</h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        Actions waiting for human approval
                      </p>
                    </div>

                    <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs text-yellow-400">
                      {pendingApprovals.length} pending
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-white/10">
                  {pendingApprovals.length === 0 ? (
                    <div className="p-5 text-sm text-zinc-500">
                      No pending approvals.
                    </div>
                  ) : (
                    pendingApprovals.map((approval) => (
                      <ApprovalCard
                        key={approval.id}
                        approval={approval}
                        onComplete={loadData}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function NavItem({
  label,
  icon,
  active = false,
  href,
}: {
  label: string;
  icon: string;
  active?: boolean;
  href?: string;
}) {
  const className = `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${active
      ? "bg-blue-500/10 text-blue-400"
      : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
    }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        <span>{icon}</span>
        {label}
      </Link>
    );
  }

  return (
    <button className={className}>
      <span>{icon}</span>
      {label}
    </button>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-xs text-zinc-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-zinc-600">{description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-green-500/10 text-green-400",
    running: "bg-blue-500/10 text-blue-400",
    pending: "bg-zinc-500/10 text-zinc-400",
    waiting_approval: "bg-yellow-500/10 text-yellow-400",
    failed: "bg-red-500/10 text-red-400",
  };

  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] ${styles[status] ?? "bg-white/5 text-zinc-400"
        }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function ApprovalCard({
  approval,
  onComplete,
}: {
  approval: Approval;
  onComplete: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function decide(action: "approve" | "reject") {
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/approvals/${approval.id}/${action}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to ${action} approval`);
      }

      await onComplete();
    } catch (error) {
      console.error(error);
      alert(`Failed to ${action} approval`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-medium capitalize">
            {approval.action}
          </h4>

          <p className="mt-1 text-xs text-zinc-500">
            Human approval required before this action executes.
          </p>
        </div>

        <span className="h-2 w-2 rounded-full bg-yellow-400" />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          disabled={loading}
          onClick={() => decide("approve")}
          className="rounded-lg bg-green-500 px-3 py-2 text-xs font-medium text-black transition hover:bg-green-400 disabled:opacity-50"
        >
          Approve
        </button>

        <button
          disabled={loading}
          onClick={() => decide("reject")}
          className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}