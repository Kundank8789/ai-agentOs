"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Task = {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type TaskStep = {
  id: string;
  step_number: number;
  step_name?: string;
  tool_name?: string;
  operation?: string;
  status: string;
  output?: unknown;
  error?: string | null;
};

type AuditLog = {
  id: string;
  task_id: string;
  task_step_id?: string | null;
  event_type: string;
  actor_type: string;
  action: string;
  message: string;
  event_metadata?: Record<string, unknown> | null;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function statusClass(status: string) {
  switch (status.toLowerCase()) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "running":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "waiting_approval":
    case "pending":
      return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    case "failed":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  }
}

function prettyStatus(status: string) {
  return status.replaceAll("_", " ");
}

export default function TaskDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [taskId, setTaskId] = useState<string | null>(null);

  const [task, setTask] = useState<Task | null>(null);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    params.then((value) => setTaskId(value.id));
  }, [params]);

  async function loadTask(id: string, showLoading = false) {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const [taskResponse, stepsResponse, auditResponse] =
        await Promise.all([
          fetch(`${API_URL}/tasks/${id}`, {
            cache: "no-store",
          }),
          fetch(`${API_URL}/tasks/${id}/steps`, {
            cache: "no-store",
          }),
          fetch(`${API_URL}/tasks/${id}/audit`, {
            cache: "no-store",
          }),
        ]);

      if (!taskResponse.ok) {
        throw new Error("Failed to load task");
      }

      if (!stepsResponse.ok) {
        throw new Error("Failed to load task steps");
      }

      if (!auditResponse.ok) {
        throw new Error("Failed to load audit logs");
      }

      const [taskData, stepsData, auditData] = await Promise.all([
        taskResponse.json(),
        stepsResponse.json(),
        auditResponse.json(),
      ]);

      setTask(taskData);
      setSteps(stepsData);
      setAuditLogs(auditData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading the task.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!taskId) return;

    loadTask(taskId, true);

    const interval = setInterval(() => {
      loadTask(taskId);
    }, 5000);

    return () => clearInterval(interval);
  }, [taskId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#09090b] text-white p-8">
        <div className="mx-auto max-w-6xl">
          <div className="animate-pulse">
            <div className="h-5 w-32 rounded bg-zinc-800" />
            <div className="mt-6 h-10 w-2/3 rounded bg-zinc-800" />
            <div className="mt-4 h-5 w-1/2 rounded bg-zinc-800" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !task) {
    return (
      <main className="min-h-screen bg-[#09090b] text-white p-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-white"
          >
            ← Back to dashboard
          </Link>

          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <h1 className="text-xl font-semibold">Unable to load task</h1>
            <p className="mt-2 text-zinc-400">
              {error || "Task was not found."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-5 border-b border-white/10 pb-6 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm text-zinc-500 transition hover:text-white"
            >
              ← Back to dashboard
            </Link>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">
                {task.title}
              </h1>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${statusClass(
                  task.status,
                )}`}
              >
                {prettyStatus(task.status)}
              </span>
            </div>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
              {task.description}
            </p>

            <div className="mt-4 flex flex-wrap gap-5 text-xs text-zinc-500">
              <span>
                Created:{" "}
                <span className="text-zinc-300">
                  {formatDate(task.created_at)}
                </span>
              </span>

              <span>
                Updated:{" "}
                <span className="text-zinc-300">
                  {formatDate(task.updated_at)}
                </span>
              </span>
            </div>
          </div>

          <button
            onClick={() => taskId && loadTask(taskId)}
            disabled={refreshing}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Execution plan */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Execution Plan</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Agent-generated execution steps
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              {steps.length === 0 ? (
                <div className="p-6 text-sm text-zinc-500">
                  No execution steps found.
                </div>
              ) : (
                steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="border-b border-white/10 p-5 last:border-b-0"
                  >
                    <div className="flex gap-4">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${statusClass(
                          step.status,
                        )}`}
                      >
                        {step.step_number || index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="font-medium text-white">
                              {step.step_name ||
                                step.operation ||
                                `Step ${step.step_number || index + 1}`}
                            </h3>

                            {step.tool_name && (
                              <p className="mt-1 text-xs text-zinc-500">
                                Tool:{" "}
                                <span className="text-zinc-300">
                                  {step.tool_name}
                                </span>
                              </p>
                            )}
                          </div>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs capitalize ${statusClass(
                              step.status,
                            )}`}
                          >
                            {prettyStatus(step.status)}
                          </span>
                        </div>

                        {step.error && (
                          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
                            {step.error}
                          </div>
                        )}

                        {step.output !== undefined &&
                          step.output !== null && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
                                View tool output
                              </summary>

                              <pre className="mt-2 max-h-60 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">
                                {JSON.stringify(step.output, null, 2)}
                              </pre>
                            </details>
                          )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Audit timeline */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Execution Timeline</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Complete audit history for this task
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              {auditLogs.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No audit events found.
                </p>
              ) : (
                <div className="relative">
                  <div className="absolute bottom-3 left-[7px] top-3 w-px bg-white/10" />

                  <div className="space-y-6">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="relative flex gap-4">
                        <div className="relative z-10 mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-zinc-900 bg-emerald-400" />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-white">
                              {log.event_type}
                            </span>

                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                              {log.actor_type}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-zinc-400">
                            {log.message}
                          </p>

                          <div className="mt-1 text-xs text-zinc-600">
                            {formatDate(log.created_at)}
                          </div>

                          {log.event_metadata && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-400">
                                Event metadata
                              </summary>

                              <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] text-zinc-500">
                                {JSON.stringify(
                                  log.event_metadata,
                                  null,
                                  2,
                                )}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Summary */}
        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <p className="text-sm text-zinc-500">Execution Steps</p>
            <p className="mt-2 text-3xl font-semibold">{steps.length}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <p className="text-sm text-zinc-500">Audit Events</p>
            <p className="mt-2 text-3xl font-semibold">
              {auditLogs.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <p className="text-sm text-zinc-500">Current Status</p>
            <p className="mt-2 text-3xl font-semibold capitalize">
              {prettyStatus(task.status)}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}