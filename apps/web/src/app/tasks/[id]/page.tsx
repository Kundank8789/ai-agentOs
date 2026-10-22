"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import {
  getTask,
  getTaskSteps,
  getTaskAudit,
  getTaskToolCalls,
  runTask,
  cancelTask,
  getAgent,
  type Agent,
  type ToolCall,
} from "@/lib/api";

type Task = {
  id: string;
  organization_id: string;
  user_id: string | null;
  agent_id: string | null;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type TaskStep = {
  id?: string;
  task_id?: string;
  step_number?: number;
  name?: string;
  title?: string;
  action?: string;
  description?: string;
  status?: string;
  input?: Record<string, unknown> | null;
  output?: unknown;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

type AuditLog = {
  id?: string;
  task_id?: string;
  task_step_id?: string;
  event_type?: string;
  actor_type?: string;
  action?: string;
  message?: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  [key: string]: unknown;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function TaskDetailsPage({ params }: PageProps) {
  const { id } = use(params);

  const [task, setTask] = useState<Task | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  const loadTaskData = useCallback(async () => {
    try {
      setError("");

      const [taskData, stepsData, auditData, toolCallsData] =
        await Promise.all([
          getTask(id),
          getTaskSteps(id),
          getTaskAudit(id),
          getTaskToolCalls(id).catch((err) => {
            console.error("Failed to load tool calls:", err);
            return [];
          }),
        ]);

      setTask(taskData);
      setSteps(Array.isArray(stepsData) ? stepsData : []);
      setAuditLogs(Array.isArray(auditData) ? auditData : []);
      setToolCalls(toolCallsData);

      if (taskData.agent_id) {
        try {
          const agentData = await getAgent(taskData.agent_id);
          setAgent(agentData);
        } catch {
          setAgent(null);
        }
      } else {
        setAgent(null);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to load task information.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTaskData();
  }, [loadTaskData]);

  useEffect(() => {
    if (!task) return;

    if (
      task.status !== "running" &&
      task.status !== "planned" &&
      task.status !== "queued"
    ) {
      return;
    }

    const interval = setInterval(() => {
      loadTaskData();
    }, 2000);

    return () => clearInterval(interval);
  }, [task, loadTaskData]);

  async function handleRefresh() {
    try {
      setRefreshing(true);
      await loadTaskData();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRunTask() {
    try {
      setRunning(true);
      setError("");

      const updatedTask = await runTask(id);

      setTask(updatedTask);
      await loadTaskData();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error ? err.message : "Task execution failed."
      );
    } finally {
      setRunning(false);
    }
  }

  async function handleCancelTask() {
    if (!window.confirm("Are you sure you want to cancel this task?")) {
      return;
    }

    try {
      setCancelling(true);
      setError("");

      const updatedTask = await cancelTask(id);
      setTask(updatedTask);

      await loadTaskData();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to cancel task.",
      );
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#09090b] p-6 text-white md:p-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-zinc-500">Loading task...</p>
        </div>
      </main>
    );
  }

  if (!task) {
    return (
      <main className="min-h-screen bg-[#09090b] p-6 text-white md:p-10">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/tasks"
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            ← Back to tasks
          </Link>

          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <p className="text-red-400">{error || "Task not found."}</p>
          </div>
        </div>
      </main>
    );
  }

  const needsApproval = task.status === "waiting_approval";
  const isTerminal = ["completed", "failed", "cancelled"].includes(
    task.status,
  );

  return (
    <main className="min-h-screen bg-[#09090b] p-6 text-white md:p-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/tasks"
          className="text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          ← Back to tasks
        </Link>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <StatusBadge status={task.status} />

                {task.agent_id && (
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-400">
                    {agent ? `🤖 ${agent.name}` : "Agent assigned"}
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {task.title}
              </h1>

              <p className="mt-3 text-zinc-400">
                {task.description || "No description provided."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <button
                onClick={handleCancelTask}
                disabled={cancelling || isTerminal}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {cancelling ? "Cancelling..." : "Cancel Task"}
              </button>

              <button
                onClick={handleRunTask}
                disabled={running || task.status === "running"}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {running || task.status === "running"
                  ? "Running..."
                  : "Run Task"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </section>

        {needsApproval && (
          <section className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium text-yellow-300">
                  Action requires human approval
                </p>

                <p className="mt-1 text-sm text-yellow-200/60">
                  The agent has paused execution until an approval decision
                  is made.
                </p>
              </div>

              <Link
                href="/approvals"
                className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-300 transition hover:bg-yellow-500/20"
              >
                Review Approval →
              </Link>
            </div>
          </section>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Execution Steps
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Runtime progress for this task.
                </p>
              </div>

              <span className="text-sm text-zinc-500">
                {steps.length}{" "}
                {steps.length === 1 ? "step" : "steps"}
              </span>
            </div>

            <div className="mt-6">
              {steps.length === 0 ? (
                <EmptyState text="No execution steps recorded yet." />
              ) : (
                <div className="space-y-3">
                  {steps.map((step, index) => (
                    <StepCard
                      key={
                        step.id ||
                        `${step.step_number || index}-${index}`
                      }
                      step={step}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="text-lg font-semibold">Current Status</h2>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-wider text-zinc-600">
                Task status
              </p>

              <p className="mt-2 text-2xl font-semibold capitalize">
                {prettyStatus(task.status)}
              </p>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full transition-all ${
                    task.status === "completed"
                      ? "w-full bg-green-500"
                      : task.status === "failed"
                        ? "w-full bg-red-500"
                        : task.status === "cancelled"
                          ? "w-full bg-zinc-500"
                          : task.status === "waiting_approval"
                            ? "w-3/4 bg-yellow-500"
                            : task.status === "running"
                              ? "w-1/2 animate-pulse bg-blue-500"
                              : task.status === "queued"
                                ? "w-1/3 bg-purple-500"
                                : "w-1/4 bg-zinc-500"
                  }`}
                />
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <InfoRow label="Task ID" value={task.id} />
              <InfoRow label="Created" value={formatDate(task.created_at)} />
              <InfoRow label="Updated" value={formatDate(task.updated_at)} />

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                  Agent
                </p>

                {agent ? (
                  <div className="mt-2">
                    <p className="font-medium text-white">
                      🤖 {agent.name}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {agent.status}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-400">
                    Not assigned
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Tool Execution History</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Tools called by the agent, with their inputs and outputs.
              </p>
            </div>
            <span className="text-sm text-zinc-500">
              {toolCalls.length} {toolCalls.length === 1 ? "call" : "calls"}
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {toolCalls.length === 0 ? (
              <EmptyState text="No tool calls recorded for this task yet." />
            ) : (
              toolCalls.map((call) => (
                <div
                  key={call.id}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-zinc-200">
                        {call.tool_name}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        Call #{call.call_number} · {formatDate(call.created_at)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        call.status === "success" || call.status === "completed"
                          ? "bg-green-500/10 text-green-400"
                          : call.status === "failed" || call.status === "error"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      {prettyStatus(call.status)}
                    </span>
                  </div>

                  {call.input_data != null && (
                    <div className="mt-4 rounded-lg border border-white/10 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Input
                      </p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 text-zinc-300">
                        {JSON.stringify(call.input_data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {call.output_data != null && (
                    <div className="mt-3 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-400">
                        Output
                      </p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 text-zinc-300">
                        {JSON.stringify(call.output_data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {call.error && (
                    <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
                        Error
                      </p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-red-300">
                        {call.error}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div>
            <h2 className="text-lg font-semibold">Audit Timeline</h2>

            <p className="mt-1 text-sm text-zinc-500">
              Everything the runtime and human operators did.
            </p>
          </div>

          <div className="mt-6">
            {auditLogs.length === 0 ? (
              <EmptyState text="No audit events recorded yet." />
            ) : (
              <div className="relative ml-2 border-l border-white/10 pl-7">
                {auditLogs.map((log, index) => (
                  <AuditEvent
                    key={log.id || `${log.created_at}-${index}`}
                    log={log}
                    last={index === auditLogs.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <MetadataCard
            title="Organization"
            value={task.organization_id}
          />

          <MetadataCard
            title="User"
            value={task.user_id || "Not assigned"}
          />
        </section>
      </div>
    </main>
  );
}

/* -----------------------------
   Step Card
----------------------------- */

function StepCard({
  step,
  index,
}: {
  step: TaskStep;
  index: number;
}) {
  const status = String(step.status || "pending");

  const title =
    step.title ||
    step.name ||
    step.action ||
    `Execution step ${index + 1}`;

  const description =
    step.description ||
    (typeof step.action === "string" ? step.action : "");

  const isCompleted =
    status === "completed" ||
    status === "success" ||
    status === "done";

  const isRunning = status === "running";

  const isWaiting =
    status === "waiting_approval" ||
    status === "approval_required" ||
    status === "pending_approval";

  const isFailed = status === "failed" || status === "error";

  return (
    <div className="flex gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-sm">
        {isCompleted ? (
          <span className="text-green-400">✓</span>
        ) : isFailed ? (
          <span className="text-red-400">×</span>
        ) : isWaiting ? (
          <span className="text-yellow-400">!</span>
        ) : isRunning ? (
          <span className="text-blue-400">●</span>
        ) : (
          <span className="text-zinc-500">
            {step.step_number ?? index + 1}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-zinc-200">{title}</h3>

          <span
            className={`text-xs capitalize ${
              isCompleted
                ? "text-green-400"
                : isFailed
                  ? "text-red-400"
                  : isWaiting
                    ? "text-yellow-400"
                    : isRunning
                      ? "text-blue-400"
                      : "text-zinc-500"
            }`}
          >
            {prettyStatus(status)}
          </span>
        </div>

        {description && (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        )}

        {step.input && (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Input
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-zinc-300">
              {JSON.stringify(step.input, null, 2)}
            </pre>
          </div>
        )}

        {step.output !== undefined && step.output !== null && (
          <div className="mt-3 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-400">
              Execution Output
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 text-zinc-300">
              {typeof step.output === "string"
                ? step.output
                : JSON.stringify(step.output, null, 2)}
            </pre>
          </div>
        )}

        {step.error && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
              Error
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-red-300">
              {step.error}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

/* -----------------------------
   Audit Event
----------------------------- */

function AuditEvent({
  log,
  last,
}: {
  log: AuditLog;
  last: boolean;
}) {
  return (
    <div className={`relative ${last ? "" : "pb-7"}`}>
      <div className="absolute -left-[35px] top-1 h-3 w-3 rounded-full border-2 border-[#09090b] bg-blue-500" />

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-medium text-zinc-200">
            {formatEvent(log.event_type || log.action || "Event")}
          </p>

          {log.actor_type && (
            <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-500">
              {log.actor_type}
            </span>
          )}
        </div>

        {log.message && (
          <p className="mt-1 text-sm text-zinc-500">{log.message}</p>
        )}

        {log.action && !log.message && (
          <p className="mt-1 text-sm text-zinc-500">{log.action}</p>
        )}

        <p className="mt-2 text-xs text-zinc-700">
          {formatDate(log.created_at)}
        </p>
      </div>
    </div>
  );
}

/* -----------------------------
   Small Components
----------------------------- */

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-green-500/10 text-green-400",
    running: "bg-blue-500/10 text-blue-400",
    pending: "bg-zinc-500/10 text-zinc-400",
    planned: "bg-purple-500/10 text-purple-400",
    queued: "bg-purple-500/10 text-purple-400",
    waiting_approval: "bg-yellow-500/10 text-yellow-400",
    failed: "bg-red-500/10 text-red-400",
    cancelled: "bg-zinc-500/10 text-zinc-400",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        styles[status] ?? "bg-white/5 text-zinc-400"
      }`}
    >
      {prettyStatus(status)}
    </span>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-[10px] uppercase tracking-wider text-zinc-600">
        {label}
      </p>

      <p className="mt-1 break-all text-sm text-zinc-400">{value}</p>
    </div>
  );
}

function MetadataCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-xs uppercase tracking-wider text-zinc-600">
        {title}
      </p>

      <p className="mt-2 break-all text-sm text-zinc-400">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
      <p className="text-sm text-zinc-600">{text}</p>
    </div>
  );
}

/* -----------------------------
   Helpers
----------------------------- */

function prettyStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatEvent(event: string) {
  return event
    .replaceAll("_", " ")
    .replaceAll(".", " → ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}