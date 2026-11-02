"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getApprovals,
  approveApproval,
  rejectApproval,
} from "@/lib/api";

type Approval = {
  id: string;
  task_id: string;
  task_step_id?: string | null;
  action: string;
  status: string;
  requested_data?: Record<string, unknown> | null;
  decided_at?: string | null;
  created_at: string;
};

type StatusFilter =
  | "all"
  | "pending"
  | "approved"
  | "executing"
  | "executed"
  | "failed"
  | "rejected";

const FILTERS: StatusFilter[] = [
  "all",
  "pending",
  "approved",
  "executing",
  "executed",
  "failed",
  "rejected",
];

function formatAction(action: string) {
  return action
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString();
}

function statusStyle(status: string) {
  switch (status.toLowerCase()) {
    case "pending":
      return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    case "approved":
    case "executing":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "executed":
      return "bg-green-500/10 text-green-400 border-green-500/20";
    case "rejected":
    case "failed":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-400 border-white/10";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${statusStyle(
        status
      )}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-600">{description}</p>
    </div>
  );
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const loadApprovals = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setRefreshing(true);

      setError("");

      const data = await getApprovals();
      setApprovals(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load approvals."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  async function handleDecision(
    approvalId: string,
    decision: "approve" | "reject"
  ) {
    const action = decision === "approve" ? "approve" : "reject";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} this action?`
    );

    if (!confirmed) return;

    try {
      setProcessing(approvalId);
      setError("");
      setNotice("");

      if (decision === "approve") {
        await approveApproval(approvalId);
        setNotice("Approval submitted. Check the execution status below.");
      } else {
        await rejectApproval(approvalId);
        setNotice("Approval rejected successfully.");
      }

      await loadApprovals();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${decision} approval.`
      );

      await loadApprovals();
    } finally {
      setProcessing(null);
    }
  }

  const counts = useMemo(() => {
    const count = (status: string) =>
      approvals.filter(
        (approval) => approval.status.toLowerCase() === status
      ).length;

    return {
      total: approvals.length,
      pending: count("pending"),
      approved: count("approved"),
      executing: count("executing"),
      executed: count("executed"),
      failed: count("failed"),
      rejected: count("rejected"),
    };
  }, [approvals]);

  const filteredApprovals = useMemo(() => {
    const query = search.trim().toLowerCase();

    return approvals
      .filter((approval) => {
        const status = approval.status.toLowerCase();

        const matchesFilter =
          filter === "all" || status === filter;

        const matchesSearch =
          !query ||
          [
            approval.action,
            approval.task_id,
            approval.task_step_id ?? "",
            approval.status,
            approval.id,
          ].some((value) => value.toLowerCase().includes(query));

        return matchesFilter && matchesSearch;
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );
  }, [approvals, filter, search]);

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-10">
        <header className="mb-9">
          <Link
            href="/"
            className="text-sm text-zinc-500 transition hover:text-white"
          >
            ← Back to dashboard
          </Link>

          <div className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-400">
                  Human in the loop
                </p>
              </div>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Approval Center
              </h1>

              <p className="mt-2 max-w-xl text-sm text-zinc-500">
                Review AI-generated actions, control execution, and
                monitor approval decisions across your workspace.
              </p>
            </div>

            <button
              onClick={() => void loadApprovals(true)}
              disabled={refreshing || loading}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-300"
          >
            {notice}
          </div>
        )}

        <section className="mb-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total requests"
            value={counts.total}
            description="All approval records"
          />
          <StatCard
            label="Pending"
            value={counts.pending}
            description="Waiting for your decision"
          />
          <StatCard
            label="Approved"
            value={counts.approved}
            description="Decision granted"
          />
          <StatCard
            label="In progress"
            value={counts.executing}
            description="Actions currently executing"
          />
          <StatCard
            label="Executed"
            value={counts.executed}
            description="Successfully completed"
          />
          <StatCard
            label="Failed / rejected"
            value={counts.failed + counts.rejected}
            description="Unsuccessful or declined"
          />
        </section>

        <section>
          <div className="mb-5 flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-semibold">
                Approval requests
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Inspect requests and track their lifecycle.
              </p>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by action, task ID, or approval ID..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500/50"
            />
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {FILTERS.map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded-lg px-4 py-2 text-sm capitalize transition ${
                  filter === value
                    ? "bg-blue-500 text-white"
                    : "border border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {value === "all" ? "All requests" : value}
                {value === "pending" && (
                  <span className="ml-2 text-xs">
                    {counts.pending}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center text-zinc-500">
              Loading approval requests...
            </div>
          ) : filteredApprovals.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-16 text-center">
              <div className="text-3xl">✓</div>
              <h3 className="mt-4 font-medium">
                No approval requests found
              </h3>
              <p className="mt-2 text-sm text-zinc-500">
                {search || filter !== "all"
                  ? "Try changing your search or status filter."
                  : "Your workspace has no approval requests yet."}
              </p>
              {(search || filter !== "all") && (
                <button
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                  className="mt-4 text-sm text-blue-400 hover:text-blue-300"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredApprovals.map((approval) => (
                <ApprovalCard
                  key={approval.id}
                  approval={approval}
                  processing={processing === approval.id}
                  onDecision={handleDecision}
                />
              ))}
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-white/10 pt-5 text-xs text-zinc-600">
          AgentOS Human Approval System · Decisions are recorded through
          your authenticated workspace.
        </footer>
      </div>
    </main>
  );
}

function ApprovalCard({
  approval,
  processing,
  onDecision,
}: {
  approval: Approval;
  processing: boolean;
  onDecision: (
    approvalId: string,
    decision: "approve" | "reject"
  ) => void;
}) {
  const pending = approval.status.toLowerCase() === "pending";

  return (
    <article
      className={`rounded-2xl border bg-white/[0.02] p-5 transition hover:bg-white/[0.035] ${
        pending
          ? "border-yellow-500/20"
          : "border-white/10"
      }`}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={approval.status} />

            <span className="text-xs text-zinc-600">
              {approval.action}
            </span>
          </div>

          <h3 className="mt-3 text-lg font-medium">
            {formatAction(approval.action)}
          </h3>

          <div className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
            <p className="break-all">
              Task ID: <span className="text-zinc-300">{approval.task_id}</span>
            </p>

            <p className="break-all">
              Approval ID: <span className="text-zinc-300">{approval.id}</span>
            </p>

            {approval.task_step_id && (
              <p className="break-all">
                Step ID: <span className="text-zinc-300">{approval.task_step_id}</span>
              </p>
            )}

            <p>
              Created: <span className="text-zinc-300">{formatDate(approval.created_at)}</span>
            </p>

            {approval.decided_at && (
              <p className="sm:col-span-2">
                Decision time:{" "}
                <span className="text-zinc-300">
                  {formatDate(approval.decided_at)}
                </span>
              </p>
            )}
          </div>

          <Link
            href={`/tasks/${approval.task_id}`}
            className="mt-4 inline-flex text-xs text-blue-400 transition hover:text-blue-300"
          >
            View task details →
          </Link>
        </div>

        {pending && (
          <div className="flex shrink-0 gap-2">
            <button
              disabled={processing}
              onClick={() => onDecision(approval.id, "reject")}
              className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing ? "Processing..." : "Reject"}
            </button>

            <button
              disabled={processing}
              onClick={() => onDecision(approval.id, "approve")}
              className="rounded-lg bg-green-500/15 px-4 py-2.5 text-sm text-green-400 transition hover:bg-green-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing ? "Processing..." : "Approve"}
            </button>
          </div>
        )}
      </div>

      {approval.requested_data && (
        <details className="mt-5 rounded-xl border border-white/5 bg-black/20 p-4">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-zinc-400">
            Inspect requested data
          </summary>

          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-zinc-400">
            {JSON.stringify(approval.requested_data, null, 2)}
          </pre>
        </details>
      )}
    </article>
  );
}