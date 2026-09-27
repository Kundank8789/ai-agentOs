"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

type Task = {
  id: string;
  organization_id: string;
  user_id: string | null;
  agent_id: string | null;
  title: string;
  description?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type TaskStep = {
  id: string;
  task_id: string;
  step_number: number;
  name?: string;
  action?: string;
  status?: string;
  description?: string;
  result?: unknown;
  created_at?: string;
  updated_at?: string;
};

type AuditLog = {
  id: string;
  task_id: string;
  task_step_id?: string | null;
  event_type: string;
  actor_type?: string;
  action?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

type Approval = {
  id: string;
  task_id: string;
  task_step_id?: string | null;
  action: string;
  status: string;
  created_at: string;
  decided_at?: string | null;
};

export default function TaskDetailsPage() {
  const params = useParams<{ id: string }>();

  const taskId = params.id;

  const [task, setTask] = useState<Task | null>(null);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadTaskData() {
    try {
      setLoading(true);
      setError("");

      const [
        taskResponse,
        stepsResponse,
        auditResponse,
        approvalsResponse,
      ] = await Promise.all([
        fetch(`${API_URL}/tasks/${taskId}`),
        fetch(`${API_URL}/tasks/${taskId}/steps`),
        fetch(`${API_URL}/tasks/${taskId}/audit`),
        fetch(`${API_URL}/approvals/`),
      ]);

      if (!taskResponse.ok) {
        throw new Error("Task not found");
      }

      if (!stepsResponse.ok) {
        throw new Error("Failed to load task steps");
      }

      if (!auditResponse.ok) {
        throw new Error("Failed to load audit logs");
      }

      if (!approvalsResponse.ok) {
        throw new Error("Failed to load approvals");
      }

      const taskData = await taskResponse.json();
      const stepsData = await stepsResponse.json();
      const auditData = await auditResponse.json();
      const approvalsData = await approvalsResponse.json();

      setTask(taskData);
      setSteps(stepsData);
      setAuditLogs(auditData);

      const taskApprovals = approvalsData.filter(
        (approval: Approval) => approval.task_id === taskId
      );

      setApprovals(taskApprovals);
    } catch (err) {
      console.error("Task details error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load task"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (taskId) {
      loadTaskData();
    }
  }, [taskId]);

  async function handleApproval(
    approvalId: string,
    decision: "approve" | "reject"
  ) {
    try {
      setActionLoading(approvalId);

      const response = await fetch(
        `${API_URL}/approvals/${approvalId}/${decision}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || `Failed to ${decision} approval`
        );
      }

      await loadTaskData();
    } catch (err) {
      console.error("Approval action error:", err);

      alert(
        err instanceof Error
          ? err.message
          : `Failed to ${decision} approval`
      );
    } finally {
      setActionLoading(null);
    }
  }

  const pendingApprovals = useMemo(
    () =>
      approvals.filter(
        (approval) => approval.status === "pending"
      ),
    [approvals]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#09090b] p-6 text-white md:p-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-zinc-400">
            Loading task...
          </p>
        </div>
      </main>
    );
  }

  if (error || !task) {
    return (
      <main className="min-h-screen bg-[#09090b] p-6 text-white md:p-10">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/tasks"
            className="text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            ← Back to tasks
          </Link>

          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <h1 className="text-xl font-semibold">
              Unable to load task
            </h1>

            <p className="mt-2 text-zinc-400">
              {error || "Task not found."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] p-6 text-white md:p-10">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <header className="mb-8">
          <Link
            href="/tasks"
            className="text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            ← Back to tasks
          </Link>

          <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight">
                  {task.title}
                </h1>

                <StatusBadge status={task.status} />
              </div>

              <p className="mt-3 max-w-3xl text-zinc-400">
                {task.description ||
                  "No description provided."}
              </p>
            </div>

            <button
              onClick={loadTaskData}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              Refresh
            </button>
          </div>
        </header>

        {/* Approval Alert */}
        {pendingApprovals.length > 0 && (
          <section className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-400">
                !
              </div>

              <div className="flex-1">
                <h2 className="text-lg font-semibold text-yellow-300">
                  Human approval required
                </h2>

                <p className="mt-1 text-sm text-zinc-400">
                  This task is waiting for your approval before
                  the agent can continue.
                </p>

                <div className="mt-5 space-y-3">
                  {pendingApprovals.map((approval) => (
                    <div
                      key={approval.id}
                      className="rounded-xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-medium text-white">
                            {formatAction(approval.action)}
                          </p>

                          <p className="mt-1 text-xs text-zinc-500">
                            Approval ID: {approval.id}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            disabled={actionLoading === approval.id}
                            onClick={() =>
                              handleApproval(
                                approval.id,
                                "reject"
                              )
                            }
                            className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {actionLoading === approval.id
                              ? "Processing..."
                              : "Reject"}
                          </button>

                          <button
                            disabled={actionLoading === approval.id}
                            onClick={() =>
                              handleApproval(
                                approval.id,
                                "approve"
                              )
                            }
                            className="rounded-lg bg-green-500/10 px-4 py-2 text-sm text-green-400 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {actionLoading === approval.id
                              ? "Processing..."
                              : "Approve"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Task Overview */}
        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard
            label="Status"
            value={formatStatus(task.status)}
          />

          <InfoCard
            label="Task ID"
            value={task.id}
            breakAll
          />

          <InfoCard
            label="Created"
            value={new Date(
              task.created_at
            ).toLocaleString()}
          />
        </section>

        {/* Execution Steps */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Execution Steps
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                What the AgentOS runtime has done for this task.
              </p>
            </div>

            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400">
              {steps.length}{" "}
              {steps.length === 1 ? "step" : "steps"}
            </span>
          </div>

          {steps.length === 0 ? (
            <div className="mt-6 rounded-xl border border-white/5 bg-black/20 p-5">
              <p className="text-sm text-zinc-500">
                No execution steps recorded yet.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="relative flex gap-4"
                >
                  {index !== steps.length - 1 && (
                    <div className="absolute left-[17px] top-10 h-[calc(100%+1rem)] w-px bg-white/10" />
                  )}

                  <StepIcon status={step.status} />

                  <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-600">
                          Step {step.step_number}
                        </p>

                        <h3 className="mt-1 font-medium text-white">
                          {step.name ||
                            step.action ||
                            `Execution step ${step.step_number}`}
                        </h3>
                      </div>

                      {step.status && (
                        <StatusBadge
                          status={step.status}
                        />
                      )}
                    </div>

                    {step.description && (
                      <p className="mt-3 text-sm text-zinc-500">
                        {step.description}
                      </p>
                    )}

                    {step.result !== undefined &&
                      step.result !== null && (
                        <details className="mt-4">
                          <summary className="cursor-pointer text-xs text-blue-400">
                            View result
                          </summary>

                          <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-zinc-400">
                            {JSON.stringify(
                              step.result,
                              null,
                              2
                            )}
                          </pre>
                        </details>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Approvals History */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-xl font-semibold">
            Approval History
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Human decisions made during task execution.
          </p>

          {approvals.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">
              No approvals recorded for this task.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {approvals.map((approval) => (
                <div
                  key={approval.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {formatAction(approval.action)}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      Created{" "}
                      {new Date(
                        approval.created_at
                      ).toLocaleString()}
                    </p>
                  </div>

                  <StatusBadge
                    status={approval.status}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Audit Timeline */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-xl font-semibold">
            Audit Timeline
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Complete activity history for this task.
          </p>

          {auditLogs.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">
              No audit events recorded yet.
            </p>
          ) : (
            <div className="mt-6 space-y-5">
              {auditLogs.map((log, index) => (
                <div
                  key={log.id}
                  className="relative flex gap-4"
                >
                  {index !== auditLogs.length - 1 && (
                    <div className="absolute left-2 top-5 h-[calc(100%+1.25rem)] w-px bg-white/10" />
                  )}

                  <div className="relative mt-1 h-4 w-4 shrink-0 rounded-full border border-blue-400/30 bg-blue-500/20" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <p className="font-medium text-zinc-200">
                        {formatEventType(
                          log.event_type
                        )}
                      </p>

                      <time className="text-xs text-zinc-600">
                        {new Date(
                          log.created_at
                        ).toLocaleString()}
                      </time>
                    </div>

                    {log.message && (
                      <p className="mt-1 text-sm text-zinc-500">
                        {log.message}
                      </p>
                    )}

                    {log.actor_type && (
                      <p className="mt-2 text-xs text-zinc-600">
                        Actor: {log.actor_type}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Technical Information */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-xl font-semibold">
            Technical Information
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InfoCard
              label="Organization ID"
              value={task.organization_id}
              breakAll
            />

            <InfoCard
              label="User ID"
              value={task.user_id || "Not assigned"}
              breakAll
            />

            <InfoCard
              label="Agent ID"
              value={task.agent_id || "Not assigned"}
              breakAll
            />

            <InfoCard
              label="Last Updated"
              value={new Date(
                task.updated_at
              ).toLocaleString()}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({
  label,
  value,
  breakAll = false,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-xs uppercase tracking-wider text-zinc-600">
        {label}
      </p>

      <p
        className={`mt-2 text-sm text-zinc-300 ${
          breakAll ? "break-all" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed:
      "bg-green-500/10 text-green-400",
    running:
      "bg-blue-500/10 text-blue-400",
    pending:
      "bg-zinc-500/10 text-zinc-400",
    planned:
      "bg-purple-500/10 text-purple-400",
    waiting_approval:
      "bg-yellow-500/10 text-yellow-400",
    pending_approval:
      "bg-yellow-500/10 text-yellow-400",
    failed:
      "bg-red-500/10 text-red-400",
  };

  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] ${
        styles[status] ??
        "bg-white/5 text-zinc-400"
      }`}
    >
      {formatStatus(status)}
    </span>
  );
}

function StepIcon({ status }: { status?: string }) {
  if (status === "completed") {
    return (
      <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-400">
        ✓
      </div>
    );
  }

  if (
    status === "running" ||
    status === "in_progress"
  ) {
    return (
      <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
        ●
      </div>
    );
  }

  if (
    status === "waiting_approval" ||
    status === "pending_approval"
  ) {
    return (
      <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-400">
        !
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400">
        ×
      </div>
    );
  }

  return (
    <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-500/10 text-zinc-400">
      ○
    </div>
  );
}

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatAction(action: string) {
  return action
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatEventType(eventType: string) {
  return eventType
    .replaceAll(".", " → ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}