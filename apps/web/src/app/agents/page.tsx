"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  createAgent,
  getAgents,
  type Agent,
} from "@/lib/api";

const capabilities = [
  "Google Sheets",
  "Gmail",
  "CRM",
  "Web Search",
  "Reasoning",
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentDescription, setAgentDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadAgents() {
    try {
      setLoading(true);
      setError("");

      const data = await getAgents();
      setAgents(data);
    } catch (error) {
      console.error("Agents fetch error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to load agents",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAgent(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!agentName.trim()) {
      setError("Agent name is required.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      await createAgent(
        agentName.trim(),
        agentDescription.trim(),
      );

      setAgentName("");
      setAgentDescription("");
      setShowCreateForm(false);

      await loadAgents();
    } catch (error) {
      console.error("Create agent error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to create agent",
      );
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    loadAgents();
  }, []);

  const activeAgents = useMemo(
    () =>
      agents.filter(
        (agent) => agent.status.toLowerCase() === "active",
      ),
    [agents],
  );

  const pausedAgents = useMemo(
    () =>
      agents.filter(
        (agent) => agent.status.toLowerCase() !== "active",
      ),
    [agents],
  );

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        <header className="mb-8">
          <Link
            href="/"
            className="text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            ← Back to dashboard
          </Link>

          <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-blue-400">
                AI Workforce
              </p>

              <h1 className="mt-2 text-4xl font-semibold tracking-tight">
                Agents
              </h1>

              <p className="mt-3 max-w-2xl text-zinc-400">
                Manage the AI employees responsible for executing
                business operations.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() =>
                  setShowCreateForm((value) => !value)
                }
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
              >
                + Create AI Employee
              </button>

              <button
                onClick={loadAgents}
                disabled={loading}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {showCreateForm && (
          <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="mb-5">
              <h2 className="text-xl font-medium">
                Create AI Employee
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Configure an AI employee for your business operations.
              </p>
            </div>

            <form onSubmit={handleCreateAgent} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Name
                </label>

                <input
                  value={agentName}
                  onChange={(event) =>
                    setAgentName(event.target.value)
                  }
                  placeholder="Operations Agent"
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Description
                </label>

                <textarea
                  value={agentDescription}
                  onChange={(event) =>
                    setAgentDescription(event.target.value)
                  }
                  placeholder="Handles orders, CRM updates, customer follow-ups and business operations."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create AI Employee"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Total agents"
            value={agents.length}
            description="AI workforce"
          />

          <StatCard
            label="Active"
            value={activeAgents.length}
            description="Ready to execute"
          />

          <StatCard
            label="Paused"
            value={pausedAgents.length}
            description="Currently inactive"
          />
        </section>

        {loading ? (
          <LoadingState />
        ) : agents.length === 0 ? (
          <EmptyState />
        ) : (
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-medium">
                  Your AI workforce
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Agents currently available in this workspace.
                </p>
              </div>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
                {agents.length}{" "}
                {agents.length === 1 ? "agent" : "agents"}
              </span>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-xs uppercase tracking-widest text-zinc-600">
        {label}
      </p>

      <p className="mt-3 text-3xl font-semibold">{value}</p>

      <p className="mt-1 text-sm text-zinc-500">{description}</p>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const active = agent.status.toLowerCase() === "active";

  return (
    <Link
      href={`/agents/${agent.id}`}
      className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-blue-500/30 hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-lg font-semibold text-blue-400">
            {agent.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <h3 className="text-lg font-medium group-hover:text-blue-400">
              {agent.name}
            </h3>

            <div className="mt-1 flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  active ? "bg-green-400" : "bg-zinc-600"
                }`}
              />

              <span
                className={`text-xs capitalize ${
                  active ? "text-green-400" : "text-zinc-500"
                }`}
              >
                {agent.status}
              </span>
            </div>
          </div>
        </div>

        <span className="text-zinc-600 transition group-hover:text-blue-400">
          →
        </span>
      </div>

      <p className="mt-5 min-h-10 text-sm leading-6 text-zinc-400">
        {agent.description ||
          "AI operations agent ready to execute business tasks."}
      </p>

      <div className="mt-5 border-t border-white/5 pt-4">
        <p className="mb-3 text-xs uppercase tracking-widest text-zinc-600">
          Capabilities
        </p>

        <div className="flex flex-wrap gap-2">
          {capabilities.map((capability) => (
            <span
              key={capability}
              className="rounded-md border border-white/5 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-500"
            >
              {capability}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-xs text-zinc-600">
        <span>Created {formatDate(agent.created_at)}</span>

        <span className="text-blue-400 opacity-0 transition group-hover:opacity-100">
          View agent →
        </span>
      </div>
    </Link>
  );
}

function LoadingState() {
  return (
    <section className="mt-8 grid gap-5 lg:grid-cols-2">
      {[1, 2].map((item) => (
        <div
          key={item}
          className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]"
        />
      ))}
    </section>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
      <p className="text-red-400">{message}</p>

      <button
        onClick={onRetry}
        className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10"
      >
        Try again
      </button>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 text-2xl text-blue-400">
        ✦
      </div>

      <h2 className="mt-5 text-xl font-medium">No agents yet</h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
        Your workspace does not have any AI employees configured yet.
      </p>
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return date.toLocaleDateString();
}