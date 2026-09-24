"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Approval = {
  id: string;
  task_id?: string | null;
  tool_name?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  description?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadApprovals() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/approvals/`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to load approvals (${response.status})`);
      }

      const data = await response.json();

      // Support either a plain array or { approvals: [...] }
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.approvals)
          ? data.approvals
          : [];

      setApprovals(items);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load approvals"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(
    approvalId: string,
    decision: "approve" | "reject"
  ) {
    try {
      setActionId(approvalId);
      setError("");

      const response = await fetch(
        `${API_URL}/approvals/${approvalId}/${decision}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          text || `Failed to ${decision} approval`
        );
      }

      await loadApprovals();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${decision} approval`
      );
    } finally {
      setActionId(null);
    }
  }

  useEffect(() => {
    loadApprovals();
  }, []);

  const pendingApprovals = approvals.filter(
    (approval) =>
      !approval.status ||
      approval.status.toLowerCase() === "pending"
  );

  const completedApprovals = approvals.filter(
    (approval) =>
      approval.status &&
      approval.status.toLowerCase() !== "pending"
  );

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Header */}
        <div className="mb-10 flex items-start justify-between">
          <div>
            <Link
              href="/"
              className="mb-4 inline-block text-sm text-zinc-500 transition hover:text-white"
            >
              ← Back to dashboard
            </Link>

            <p className="text-sm font-medium text-blue-400">
              Control Center
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Approval Center
            </h1>

            <p className="mt-3 max-w-2xl text-zinc-400">
              Review sensitive AI actions before they are executed.
              Humans stay in control of emails, CRM changes, and other
              external actions.
            </p>
          </div>

          <button
            onClick={loadApprovals}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Stats */}
        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm text-zinc-500">Total approvals</p>
            <p className="mt-2 text-3xl font-semibold">
              {approvals.length}
            </p>
          </div>

          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.05] p-6">
            <p className="text-sm text-zinc-500">
              Pending review
            </p>
            <p className="mt-2 text-3xl font-semibold text-yellow-300">
              {pendingApprovals.length}
            </p>
          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.05] p-6">
            <p className="text-sm text-zinc-500">Decided</p>
            <p className="mt-2 text-3xl font-semibold text-green-300">
              {completedApprovals.length}
            </p>
          </div>
        </section>

        {/* Pending approvals */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Pending approvals
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Actions waiting for human authorization
              </p>
            </div>

            <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-300">
              {pendingApprovals.length} pending
            </span>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-zinc-500">
              Loading approvals...
            </div>
          ) : pendingApprovals.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
              <div className="text-3xl">✓</div>
              <h3 className="mt-3 text-lg font-medium">
                No pending approvals
              </h3>
              <p className="mt-2 text-sm text-zinc-500">
                All sensitive actions have been reviewed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingApprovals.map((approval) => (
                <div
                  key={approval.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-yellow-300">
                          Pending
                        </span>

                        <span className="text-sm font-medium text-blue-400">
                          {approval.tool_name || "Action"}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-semibold">
                        Approval required for{" "}
                        {approval.tool_name || "external action"}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        {approval.description ||
                          approval.reason ||
                          "This action requires human approval before execution."}
                      </p>

                      {approval.task_id && (
                        <Link
                          href={`/tasks/${approval.task_id}`}
                          className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300"
                        >
                          View related task →
                        </Link>
                      )}

                      <p className="mt-3 font-mono text-xs text-zinc-600">
                        ID: {approval.id}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-3">
                      <button
                        onClick={() =>
                          handleDecision(
                            approval.id,
                            "approve"
                          )
                        }
                        disabled={actionId === approval.id}
                        className="rounded-xl bg-green-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionId === approval.id
                          ? "Processing..."
                          : "Approve"}
                      </button>

                      <button
                        onClick={() =>
                          handleDecision(
                            approval.id,
                            "reject"
                          )
                        }
                        disabled={actionId === approval.id}
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Completed decisions */}
        {completedApprovals.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-semibold">
              Recent decisions
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Previously reviewed actions
            </p>

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
              {completedApprovals.map((approval, index) => (
                <div
                  key={approval.id}
                  className={`flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between ${
                    index !== completedApprovals.length - 1
                      ? "border-b border-white/10"
                      : ""
                  }`}
                >
                  <div>
                    <p className="font-medium">
                      {approval.tool_name || "External action"}
                    </p>

                    <p className="mt-1 text-xs text-zinc-600">
                      {approval.id}
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
                      approval.status?.toLowerCase() ===
                      "approved"
                        ? "bg-green-500/10 text-green-300"
                        : "bg-red-500/10 text-red-300"
                    }`}
                  >
                    {approval.status || "Completed"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}