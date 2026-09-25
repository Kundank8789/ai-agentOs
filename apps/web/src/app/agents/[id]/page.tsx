"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

type Agent = {
  id: string;
  name: string;
  description?: string;
  status?: string;
  created_at?: string;
};

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAgent() {
      try {
        const response = await fetch(
          `${API_URL}/agents/${params.id}`
        );

        if (!response.ok) {
          throw new Error("Agent not found");
        }

        const data = await response.json();
        setAgent(data);
      } catch (error) {
        console.error("Agent fetch error:", error);
        setError("Unable to load agent");
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      loadAgent();
    }
  }, [params.id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#09090b] p-10 text-white">
        <p className="text-zinc-400">Loading agent...</p>
      </main>
    );
  }

  if (error || !agent) {
    return (
      <main className="min-h-screen bg-[#09090b] p-10 text-white">
        <Link
          href="/agents"
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          ← Back to agents
        </Link>

        <div className="mt-10 rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <h1 className="text-xl font-semibold">
            Agent not found
          </h1>

          <p className="mt-2 text-zinc-400">
            We couldn't load this agent.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] p-6 text-white md:p-10">
      <div className="mx-auto max-w-4xl">

        <Link
          href="/agents"
          className="text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          ← Back to agents
        </Link>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-8">

          <div className="flex items-start justify-between gap-6">

            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-2xl text-blue-400">
                ✦
              </div>

              <h1 className="mt-5 text-3xl font-semibold">
                {agent.name}
              </h1>

              <p className="mt-3 max-w-2xl text-zinc-400">
                {agent.description || "No description provided."}
              </p>
            </div>

            <span className="rounded-full bg-green-500/10 px-3 py-1.5 text-sm text-green-400">
              {agent.status || "unknown"}
            </span>

          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-wider text-zinc-600">
                Agent ID
              </p>

              <p className="mt-2 break-all text-sm text-zinc-300">
                {agent.id}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-wider text-zinc-600">
                Created
              </p>

              <p className="mt-2 text-sm text-zinc-300">
                {agent.created_at
                  ? new Date(agent.created_at).toLocaleString()
                  : "Unknown"}
              </p>
            </div>

          </div>

        </div>

      </div>
    </main>
  );
}