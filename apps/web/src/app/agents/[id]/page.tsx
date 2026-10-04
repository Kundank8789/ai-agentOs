"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getAgent, type Agent } from "@/lib/api";

const tools = [
  {
    name: "Google Sheets",
    description: "Read and process business data.",
  },
  {
    name: "Gmail",
    description: "Prepare and send customer communications.",
  },
  {
    name: "CRM",
    description: "Update customer and business records.",
  },
  {
    name: "Web Search",
    description: "Research external information.",
  },
  {
    name: "Reasoning",
    description: "Analyze data and make execution decisions.",
  },
];

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAgent() {
    try {
      setLoading(true);
      setError("");

      const data = await getAgent(agentId);
      setAgent(data);
    } catch (error) {
      console.error("Agent fetch error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to load agent",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (agentId) {
      loadAgent();
    }
  }, [agentId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#09090b] p-6 text-white md:p-10">
        <div className="mx-auto max-w-5xl">
          <div className="h-8 w-32 animate-pulse rounded bg-white/5" />
          <div className="mt-8 h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />
        </div>
      </main>
    );
  }

  if (error || !agent) {
    return (
      <main className="min-h-screen bg-[#09090b] p-6 text-white md:p-10">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/agents"
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            ← Back to agents
          </Link>

          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-10 text-center">
            <p className="text-red-400">
              {error || "Agent not found"}
            </p>

            <button
              onClick={loadAgent}
              className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10"
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  const active = agent.status.toLowerCase() === "active";

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        <Link
          href="/agents"
          className="text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          ← Back to agents
        </Link>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
            <div className="flex gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-2xl font-semibold text-blue-400">
                {agent.name.charAt(0).toUpperCase()}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight">
                    {agent.name}
                  </h1>

                  <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        active
                          ? "bg-green-400"
                          : "bg-zinc-600"
                      }`}
                    />

                    <span
                      className={
                        active
                          ? "text-green-400"
                          : "text-zinc-500"
                      }
                    >
                      {agent.status}
                    </span>
                  </span>
                </div>

                <p className="mt-3 max-w-2xl text-zinc-400">
                  {agent.description ||
                    "AI operations agent for executing business workflows."}
                </p>
              </div>
            </div>

            <button
              onClick={loadAgent}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10"
            >
              Refresh
            </button>
          </div>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-3">
          <InfoCard
            label="Status"
            value={agent.status}
          />

          <InfoCard
            label="Created"
            value={formatDate(agent.created_at)}
          />

          <InfoCard
            label="Agent ID"
            value={agent.id}
            small
          />
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-medium">
              Capabilities
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Tools available to this AI employee.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                    ✦
                  </span>

                  <h3 className="font-medium">
                    {tool.name}
                  </h3>
                </div>

                <p className="mt-3 text-sm leading-6 text-zinc-500">
                  {tool.description}
                </p>

                <div className="mt-4 flex items-center gap-2 text-xs text-green-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  Available
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-blue-500/10 bg-blue-500/[0.03] p-6">
          <p className="text-xs uppercase tracking-widest text-blue-400">
            AgentOS Runtime
          </p>

          <h2 className="mt-2 text-lg font-medium">
            Human-controlled execution
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            Sensitive actions such as customer communication and CRM
            updates pause automatically until a human operator approves
            them.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <RuntimeItem label="AI Planning" />
            <RuntimeItem label="Tool Execution" />
            <RuntimeItem label="Human Approval" />
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-xs uppercase tracking-widest text-zinc-600">
        {label}
      </p>

      <p
        className={`mt-3 ${
          small
            ? "break-all text-xs text-zinc-400"
            : "text-lg font-medium"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RuntimeItem({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-green-400" />
        <span className="text-sm text-zinc-300">
          {label}
        </span>
      </div>

      <p className="mt-1 text-xs text-green-400">
        Active
      </p>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return date.toLocaleString();
}