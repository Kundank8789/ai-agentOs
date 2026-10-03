"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  async function loadApprovals() {
    try {
      setLoading(true);

      const data = await getApprovals();

      setApprovals(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Approvals fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApprovals();
  }, []);

  async function handleDecision(
    approvalId: string,
    decision: "approve" | "reject"
  ) {
    try {
      setProcessing(approvalId);

      if (decision === "approve") {
        await approveApproval(approvalId);
      } else {
        await rejectApproval(approvalId);
      }

      await loadApprovals();
    } catch (error) {
      console.error(`Approval ${decision} error:`, error);
      alert(
        error instanceof Error
          ? error.message
          : `Failed to ${decision} approval`
      );
    } finally {
      setProcessing(null);
    }
  }

  const pendingApprovals = approvals.filter(
    (approval) => approval.status === "pending"
  );

  const history = approvals.filter(
    (approval) => approval.status !== "pending"
  );

  return (
    <main className="min-h-screen bg-[#09090b] p-6 text-white md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <Link
            href="/"
            className="text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            ← Back to dashboard
          </Link>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Approval Center
              </h1>

              <p className="mt-2 text-zinc-400">
                Review AI actions that require human approval.
              </p>
            </div>

            <button
              onClick={loadApprovals}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              Refresh
            </button>
          </div>
        </header>

        {loading ? (
          <p className="text-zinc-500">Loading approvals...</p>
        ) : (
          <>
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-medium">
                  Pending approvals
                </h2>

                <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs text-yellow-400">
                  {pendingApprovals.length} pending
                </span>
              </div>

              {pendingApprovals.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
                  <p className="text-zinc-400">
                    No pending approvals.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {pendingApprovals.map((approval) => (
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

            <section className="mt-10">
              <h2 className="mb-4 text-lg font-medium">
                Approval history
              </h2>

              {history.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
                  <p className="text-zinc-500">
                    No approval history yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((approval) => (
                    <HistoryCard
                      key={approval.id}
                      approval={approval}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
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
  return (
    <div className="rounded-2xl border border-yellow-500/20 bg-white/[0.02] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-yellow-500/10 px-2.5 py-1 text-[11px] uppercase text-yellow-400">
              Pending
            </span>

            <span className="text-xs text-zinc-600">
              {approval.action}
            </span>
          </div>

          <h3 className="mt-3 text-lg font-medium">
            {formatAction(approval.action)}
          </h3>

          <p className="mt-2 text-sm text-zinc-500">
            Task: {approval.task_id}
          </p>

          {approval.task_step_id && (
            <p className="mt-1 text-xs text-zinc-600">
              Step: {approval.task_step_id}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            disabled={processing}
            onClick={() => onDecision(approval.id, "reject")}
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing ? "..." : "Reject"}
          </button>

          <button
            disabled={processing}
            onClick={() => onDecision(approval.id, "approve")}
            className="rounded-lg bg-green-500/15 px-4 py-2 text-sm text-green-400 transition hover:bg-green-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing ? "..." : "Approve"}
          </button>
        </div>
      </div>

      {approval.requested_data && (
        <div className="mt-5 rounded-xl border border-white/5 bg-black/20 p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-zinc-600">
            Requested action
          </p>

          <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-zinc-400">
            {JSON.stringify(approval.requested_data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function HistoryCard({ approval }: { approval: Approval }) {
  const approved = approval.status === "approved";

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            approved
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {approved ? "✓" : "✕"}
        </span>

        <div>
          <p className="text-sm font-medium">
            {formatAction(approval.action)}
          </p>

          <p className="mt-1 text-xs text-zinc-600">
            {approval.task_id}
          </p>
        </div>
      </div>

      <span
        className={`text-xs capitalize ${
          approved ? "text-green-400" : "text-red-400"
        }`}
      >
        {approval.status}
      </span>
    </div>
  );
}

function formatAction(action: string) {
  return action
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}